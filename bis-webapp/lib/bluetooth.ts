// BIS BLE v1 uses a single 20-byte frame, so it also works at the default ATT MTU.
export const BIS_BLE_SERVICE = "b1540001-6f8a-4f98-a773-1d59ad754b10";
export const BIS_BLE_COMMAND = "b1540002-6f8a-4f98-a773-1d59ad754b10";
export const BIS_BLE_DATA = "b1540003-6f8a-4f98-a773-1d59ad754b10";
export const BIS_BLE_STATUS = "b1540004-6f8a-4f98-a773-1d59ad754b10";

export type BluetoothFrame = {
  connected: boolean; frequency_hz: number; resistance: number; reactance: number;
  impedance: number; phase: number; sample: number; total_samples: number;
  measuring: boolean; simulated: boolean;
};

// Local structural types avoid an extra dependency for the browser's optional API.
type Characteristic = {
  readValue(): Promise<DataView>;
  writeValueWithResponse(value: Uint8Array<ArrayBuffer>): Promise<void>;
};
type Service = { getCharacteristic(uuid: string): Promise<Characteristic> };
type GattServer = {
  connected: boolean; connect(): Promise<GattServer>; disconnect(): void;
  getPrimaryService(uuid: string): Promise<Service>;
};
type Device = {
  name?: string; gatt?: GattServer;
  addEventListener(type: "gattserverdisconnected", listener: () => void): void;
  removeEventListener(type: "gattserverdisconnected", listener: () => void): void;
};
type BluetoothApi = { requestDevice(options: { filters: { services: string[] }[] }): Promise<Device> };

export function bluetoothSupportReason(): string | null {
  if (!globalThis.isSecureContext) return "Bluetooth needs a localhost or HTTPS address.";
  if (!(navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth) {
    return "Bluetooth is unavailable in this browser. Open the app in Chrome or Edge on this computer.";
  }
  return null;
}

export function decodeBluetoothFrame(view: DataView): BluetoothFrame {
  if (view.byteLength !== 20 || view.getUint8(0) !== 1) {
    throw new Error("Unexpected Bluetooth data. Upload the BISBluetooth sketch to the ESP32.");
  }
  const flags = view.getUint8(1);
  if (flags & 4) throw new Error("ESP32 rejected the sweep cursor. Start a new measurement.");
  const sample = view.getUint8(2), total = view.getUint8(3);
  const frequency = view.getUint32(4, true);
  const resistance = view.getFloat32(8, true), reactance = view.getFloat32(12, true);
  const phase = view.getFloat32(16, true);
  if (total !== 11 || sample > total || (sample > 0 && frequency === 0) ||
      ![resistance, reactance, phase].every(Number.isFinite)) {
    throw new Error("Invalid Bluetooth sweep frame.");
  }
  return { connected: true, frequency_hz: frequency, resistance, reactance,
    impedance: Math.hypot(resistance, reactance), phase, sample, total_samples: total,
    measuring: Boolean(flags & 1), simulated: Boolean(flags & 2) };
}

export function bluetoothError(error: unknown): string {
  if (error instanceof Error && error.name === "NotFoundError") {
    const message = error.message.toLowerCase();
    if (message.includes("globally disabled") || message.includes("not supported")) {
      return "Web Bluetooth is disabled in this browser. In Brave, enable Web Bluetooth API at brave://flags/#brave-web-bluetooth-api and relaunch, or use Chrome or Edge.";
    }
    if (message.includes("adapter")) return "Bluetooth adapter unavailable. Turn on this computer's Bluetooth, then try again.";
    return "No Bluetooth device selected. If no picker appeared in Brave, enable Web Bluetooth API at brave://flags/#brave-web-bluetooth-api and relaunch, or use Chrome or Edge.";
  }
  if (error instanceof Error && (error.name === "SecurityError" || error.name === "NotAllowedError")) {
    return "Bluetooth access was blocked. Allow Bluetooth for this page, or open it in Chrome or Edge.";
  }
  return error instanceof Error ? error.message : "Bluetooth connection failed. Check the ESP32 and try again.";
}

export class BISBluetoothClient {
  private device: Device | null = null;
  private command: Characteristic | null = null;
  private data: Characteristic | null = null;
  private status: Characteristic | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private generation = 0;
  constructor(private readonly onDisconnected: () => void) {}

  get connected() { return Boolean(this.device?.gatt?.connected && this.command && this.data && this.status); }

  private dropped = () => {
    this.clear();
    this.onDisconnected();
  };

  private clear() {
    ++this.generation;
    this.device?.removeEventListener("gattserverdisconnected", this.dropped);
    this.device = null;
    this.command = this.data = this.status = null;
    this.queue = Promise.resolve();
  }

  disconnect() {
    const device = this.device;
    const wasConnected = Boolean(device?.gatt?.connected);
    this.clear();
    device?.gatt?.disconnect();
    if (wasConnected) this.onDisconnected();
  }

  private async deadline<T>(operation: Promise<T>): Promise<T> {
    const generation = this.generation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation, new Promise<never>((_, reject) => {
        timer = setTimeout(() => { if (generation === this.generation) this.disconnect(); reject(new Error("Bluetooth timed out. Reconnect the ESP32 and try again.")); }, 10000);
      })]);
    } finally { clearTimeout(timer); }
  }

  async connect() {
    const reason = bluetoothSupportReason();
    if (reason) throw new Error(reason);
    if (this.connected) return;
    const generation = ++this.generation;
    const bluetooth = (navigator as Navigator & { bluetooth: BluetoothApi }).bluetooth;
    // Keep requestDevice on the direct button-click call path (user activation).
    const device = await bluetooth.requestDevice({ filters: [{ services: [BIS_BLE_SERVICE] }] });
    if (generation !== this.generation) throw new Error("Bluetooth connection cancelled.");
    this.device = device;
    device.addEventListener("gattserverdisconnected", this.dropped);
    try {
      if (!device.gatt) throw new Error("This device has no Bluetooth LE service.");
      const connection = device.gatt.connect();
      void connection.then(server => { if (generation !== this.generation) server.disconnect(); }, () => undefined);
      const server = await this.deadline(connection);
      const service = await this.deadline(server.getPrimaryService(BIS_BLE_SERVICE));
      const command = await this.deadline(service.getCharacteristic(BIS_BLE_COMMAND));
      const data = await this.deadline(service.getCharacteristic(BIS_BLE_DATA));
      const status = await this.deadline(service.getCharacteristic(BIS_BLE_STATUS));
      if (generation !== this.generation) { server.disconnect(); throw new Error("Bluetooth connection cancelled."); }
      this.command = command; this.data = data; this.status = status;
      await this.readStatus();
    } catch (error) { this.disconnect(); throw error; }
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const generation = this.generation;
    const next = this.queue.then(async () => {
      if (generation !== this.generation || !this.connected) throw new Error("ESP32 Bluetooth is disconnected.");
      return this.deadline(operation());
    });
    // A failed request must not poison subsequent GATT operations.
    this.queue = next.catch(() => undefined);
    return next;
  }

  readStatus() { return this.serial(async () => decodeBluetoothFrame(await this.status!.readValue())); }

  start() {
    return this.serial(async () => {
      await this.command!.writeValueWithResponse(new TextEncoder().encode("START"));
      const frame = decodeBluetoothFrame(await this.data!.readValue());
      if (frame.sample !== 0 || !frame.measuring) throw new Error("ESP32 did not acknowledge a new sweep.");
    });
  }

  readAfter(accepted: number) {
    if (!Number.isInteger(accepted) || accepted < 0 || accepted > 11) return Promise.reject(new Error("Invalid sample cursor."));
    return this.serial(async () => {
      await this.command!.writeValueWithResponse(new TextEncoder().encode(`NEXT:${accepted}`));
      return decodeBluetoothFrame(await this.data!.readValue());
    });
  }
}
