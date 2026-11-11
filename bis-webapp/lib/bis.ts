export type BISSample = {
  frequency: number;
  resistance: number;
  reactance: number;
  impedance: number;
  phase: number;
};

export function calculateImpedance(
  resistance: number,
  reactance: number
) {
  const impedance = Math.sqrt(
    resistance ** 2 + reactance ** 2
  );

  const phase =
    Math.atan2(reactance, resistance) *
    (180 / Math.PI);

  return {
    impedance,
    phase,
  };
}

export function generateSimulatedBISData(): BISSample[] {
  const frequencies = [
    4000,
    8000,
    10000,
    16000,
    20000,
    30000,
    40000,
    60000,
    80000,
    100000,
    120000,
  ];

  return frequencies.map((frequency) => {
    const normalizedFrequency =
      Math.log10(frequency / 4000) /
      Math.log10(120000 / 4000);

    const resistance =
      92 -
      normalizedFrequency * 22 +
      Math.sin(normalizedFrequency * Math.PI) * 2;

    const reactance =
      -5 -
      Math.sin(normalizedFrequency * Math.PI) * 12;

    const { impedance, phase } =
      calculateImpedance(
        resistance,
        reactance
      );

    return {
      frequency,
      resistance,
      reactance,
      impedance,
      phase,
    };
  });
}