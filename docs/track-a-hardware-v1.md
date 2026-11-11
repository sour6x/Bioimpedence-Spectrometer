# Track A - Excitation and Calibration Board, V1

## Purpose

This board generates the known AC stimulus for the bio-impedance spectrometer and provides a measured current-reference signal to Track B. Revision 1 is a **bench instrument for resistor and RC phantom loads only**. It must not be connected to a person, and it must not be connected to a USB-powered computer while attached to a person.

The later human-connected revision needs a separate safety review, battery operation, isolation architecture, fault-current limits, and validation against the applicable medical electrical safety requirements. This V1 board is for proving the measurement chain.

## V1 target specification

| Item | Target |
| --- | --- |
| Sweep frequencies | 5, 10, 20, 40, 80, 100 kHz initially; expandable to 120 kHz |
| Excitation | sine wave, 100 uA RMS nominal |
| Load range | 10 ohm to 1 kohm phantom loads |
| Compliance | at least 2 V peak at the load terminals |
| Current accuracy goal | within 1% after current-reference measurement |
| Calibration standards | manual headers/jumpers in V1; relay footprint reserved for V2 |
| Analog supply | +5 V and -5 V bench supplies for V1 |
| Digital supply | +3.3 V supplied by Track B |
| Control | 3-wire SPI from Track B |

## Architecture

```text
Track B MCU --SPI--> DDS sine generator --> reconstruction filter --> current driver --> I+ / I-
                                   |                                  |
                                   +--> SYNC_OUT                      +--> I_REF_OUT

                                                 phantom / later electrodes
                                                       |
Track B sensing board <-------------------- V+ / V- sense terminals
```

`SYNC_OUT` is the clean excitation reference for Track B's synchronous demodulation. `I_REF_OUT` is a buffered voltage proportional to the actual injected current. Track B must sample it alongside its sensed-voltage channel.

## Circuit blocks

### A1. DDS and reference clock

- **U1:** AD9833BRMZ, powered at 3.3 V.
- **X1:** 25 MHz CMOS oscillator, 3.3 V, low-jitter, four-pad SMD package.
- Program U1 using `DDS_SCLK`, `DDS_MOSI`, and `DDS_FSYNC` from Track B.
- Bring the AD9833 `VOUT` through its recommended load resistor and a simple low-pass reconstruction filter. Keep the filter corner above 150 kHz and below the 25 MHz clock feedthrough region.
- Make `DDS_SINE_RAW` and `SYNC_OUT` labelled test points. Track B should use the post-filter, buffered signal as its phase reference.

The AD9833 provides programmable sine output with a 28-bit frequency register and SPI control, which is ample resolution for this sweep range. [AD9833 product documentation](https://www.analog.com/en/products/ad9833.html)

### A2. Buffer and programmable excitation amplitude

- **U2A:** OPA2192 unity-gain buffer for the filtered DDS waveform.
- Put a small passive divider before U2A so `V_STIM` is 200 mV RMS at the nominal DDS setting. Add optional gain pads only if the measured DDS amplitude is lower than this target.
- Fit a 0-ohm link to bypass the divider during bring-up.
- Keep this entire analog section on +/-5 V rails. The OPA2192 is rail-to-rail, low offset, and has 10 MHz gain bandwidth, which leaves margin at 120 kHz. [OPA192 family documentation](https://www.ti.com/product/OPA192)

### A3. Precision current driver

Use an **improved Howland current pump**, designed around U2B and a matched 0.1% resistor network. This is the only block that drives the load.

- Target transconductance: **0.5 mA/V**.
- With `V_STIM = 200 mV RMS`, the nominal load current is **100 uA RMS**.
- Use a 2.000 kohm, 0.1%, low-tempco resistor as the current-setting element.
- Use equal-ratio 10.0 kohm / 10.0 kohm arms from a single 0.1% matched resistor network. Layout symmetry matters; do not use four random 1% resistors.
- Put a 100 ohm series resistor directly at each output connector terminal and include pads for small compensation capacitors (`C_COMP`, DNP initially) following the op-amp stability test.
- Label the drive terminals `I_PLUS` and `I_MINUS`.

The current driver must be verified into 10 ohm, 100 ohm, 1 kohm, and RC phantom loads before connecting the sensing board. A current-reference measurement corrects residual current error; it does not replace a stable driver.

### A4. Current-reference output

- Place a 100 ohm, 0.1% current-sense resistor in the return leg, on the board side of `I_MINUS`.
- Buffer its differential voltage using a dedicated differential amplifier stage (U3) with gain 10.
- Export the result as bipolar `I_REF_OUT` and `I_REF_GND` to Track B.
- At 100 uA RMS, the raw shunt voltage is 10 mV RMS and the exported reference is 100 mV RMS. Track B must retain sufficient gain/ADC resolution for this channel.

Do not use the DDS voltage as a substitute for `I_REF_OUT`; load compliance, output impedance, and cable effects mean the actual current is the value needed for `Z = V / I`.

### A5. Calibration load connector and variable phantom (V1)

Use a 2x5 2.54 mm header (`CAL_SEL`) that selects one external or onboard two-terminal calibration load across `I_PLUS` and `I_MINUS`:

| Position | Load | Purpose |
| --- | --- | --- |
| OPEN | no load | leakage and offset baseline |
| R100 | 100 ohm, 0.1%, <=25 ppm/C | main gain/phase calibration |
| R1K | 1.00 kohm, 0.1%, <=25 ppm/C | compliance / linearity check |
| RC | 100 ohm + 15 nF series RC network | frequency-dependent phase check |
| EXT | external phantom terminals | test networks and later Track B integration |

For V2 self-calibration, reserve PCB area for low-thermal-EMF signal relays that switch the same standards. Do not use a 2.5-ohm analog switch in series with the 100-ohm calibration standard; its on-resistance and temperature drift would contaminate the reference.

The external position is not merely a resistor box. Build the dedicated variable, Cole-style RC phantom described in [variable-impedance-phantom-v1.md](variable-impedance-phantom-v1.md). It gives Track A and Track B a repeatable, body-like complex load and is the only load used until V1 has passed its acceptance tests.

## Track A <-> Track B connector

Use a keyed 2x10 shrouded header. Keep analog grounds and digital ground connected at one deliberate star point beside the power entry.

| Pin | Net | Direction | Notes |
| --- | --- | --- | --- |
| 1 | +3V3 | B -> A | DDS digital supply |
| 2 | DGND | shared | digital return |
| 3 | +5VA | B/bench -> A | analog positive rail |
| 4 | -5VA | B/bench -> A | analog negative rail |
| 5 | AGND | shared | analog return |
| 6 | DDS_SCLK | B -> A | SPI clock |
| 7 | DDS_MOSI | B -> A | SPI data |
| 8 | DDS_FSYNC | B -> A | DDS chip select |
| 9 | SYNC_OUT | A -> B | buffered phase reference |
| 10 | I_REF_OUT | A -> B | buffered current reference |
| 11 | I_REF_GND | A -> B | reference return |
| 12 | CAL0 | B -> A | V2 relay control reserve |
| 13 | CAL1 | B -> A | V2 relay control reserve |
| 14 | CAL_EN | B -> A | V2 relay enable reserve |
| 15-20 | reserved | - | guard / future signals |

Use a separate four-terminal connector for the load: `I_PLUS`, `V_PLUS`, `V_MINUS`, `I_MINUS`. Track A owns only the two current terminals. Track B owns `V_PLUS` and `V_MINUS` and must keep them high impedance.

## Initial bill of materials

| Ref | Part / value | Minimum requirement |
| --- | --- | --- |
| U1 | AD9833BRMZ | programmable DDS sine generator |
| X1 | 25 MHz, 3.3 V CMOS oscillator | low jitter, SMD |
| U2 | OPA2192 | dual precision op amp, +/-5 V capable |
| U3 | differential current-sense amplifier | gain 10, bandwidth >=1 MHz; select with Track B ADC range |
| RN1 | 10 kohm matched resistor network | 0.1% ratio, <=25 ppm/C tracking |
| RSET | 2.000 kohm | 0.1%, <=25 ppm/C |
| RSENSE | 100 ohm | 0.1%, <=25 ppm/C |
| R100 | 100 ohm | 0.1%, <=25 ppm/C |
| R1K | 1.00 kohm | 0.1%, <=25 ppm/C |
| CRC | 15 nF C0G/NP0 | 2% or better |
| CDEC | 100 nF + 10 uF per IC rail | placed at IC supply pins |
| J1 | 2x10 keyed/shrouded header | Track A/B interface |
| J2 | 4-terminal load connector | current and sense terminals clearly keyed/labeled |
| TP1-TP6 | test points | raw DDS, sync, stimulus, I+, I-, I-ref |

## Bring-up sequence and acceptance tests

1. With the current driver disconnected, power the board from current-limited +/-5 V and 3.3 V rails. Confirm no rail has an unexpected load.
2. Program 5, 10, 20, 40, 80, and 100 kHz. Confirm the post-filter waveform is sinusoidal and frequency-correct on an oscilloscope.
3. Set `V_STIM` to 200 mV RMS. Confirm its amplitude is stable across the sweep.
4. Fit the current driver and use a 100-ohm dummy load. Confirm approximately 100 uA RMS actual current with an oscilloscope or precision DMM.
5. Repeat on 10 ohm, 100 ohm, and 1 kohm loads. Record current amplitude and phase at each frequency.
6. Measure `I_REF_OUT` simultaneously with the actual load current. Its transfer function must be repeatable; Track B will use this signal in every impedance calculation.
7. Test OPEN, R100, R1K, and RC calibration positions. Save the raw capture files as the baseline for the V2 calibration algorithm.

## Board-layout rules

- Keep the DDS clock and SPI traces away from the low-level current-reference and Track B sense connections.
- Make the current-pump resistor network and feedback traces short and symmetrical.
- Put test points on every signal required by the bring-up sequence.
- Do not route digital return current beneath the precision analog network.
- Place all decoupling capacitors at the IC supply pins, not at the power connector.
- Clearly silk-screen `BENCH ONLY - NOT FOR HUMAN CONNECTION` on V1.

## Next Track A deliverable

Turn this specification into a KiCad schematic with the connector pinout fixed. Do not place the V2 relay calibration circuit until the V1 current-source and reference-channel tests have passed.
