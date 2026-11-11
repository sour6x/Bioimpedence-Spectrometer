# Variable Bio-Impedance Phantom, V1

## Goal

This plug-in phantom replaces a person during development. It presents a selectable, repeatable **complex impedance** to the complete spectrometer so we can validate the excitation board, sensing board, demodulation, Cole-Cole plot, and later self-calibration without human testing.

It connects to the same four load terminals used by the future electrode cable:

```text
I+ ----+-------------------+---- I-
       |                   |
      R_E             R_I + C_M
       |                   |
V+ ----+-------------------+---- V-
```

`V+` and `V-` are Kelvin sense terminals. For this passive phantom, they sit directly at the load terminals. The excitation path uses `I+` and `I-`.

## Electrical model

Use the one-pole Cole-style model from the supplied BIS paper:

```text
Z(f) = R_E || (R_I + 1 / (j * 2 * pi * f * C_M))
```

`R_E` represents the extracellular resistive path. `R_I` plus `C_M` represents the intracellular path behind the cell-membrane capacitance. A variable resistor alone would test only amplitude; it would not test phase extraction or the Cole-Cole curve.

## Hardware implementation

Build the phantom as a small, separate two-layer board. For V1, select component values with rotary switches or jumpers. Do not use potentiometers: their wiper/contact noise and poor tolerance make them unsuitable as a measurement reference.

```text
                    branch A
I+ --+------[ select R_E ]------+-- I-
     |                          |
     |         branch B         |
     +--[ select R_I ]--[ select C_M ]--+

V+ is tied to I+ at the phantom terminal.
V- is tied to I- at the phantom terminal.
```

Use one `1P4T` rotary switch for `R_E`, one for `R_I`, and one for `C_M`. A jumper or fifth switch position should provide OPEN for each branch. Keep the short traces between the switches and components wide and direct.

## Recommended selectable values

All resistors should be metal-film, 0.1%, <=25 ppm/C. Capacitors must be C0G/NP0, 2% or better.

| Selector | Position 1 | Position 2 | Position 3 | Position 4 | Why |
| --- | ---: | ---: | ---: | --- | --- |
| `R_E` | 30.1 ohm | 47.5 ohm | 82.0 ohm | 121 ohm | changes low-frequency resistance |
| `R_I` | 30.1 ohm | 47.5 ohm | 82.0 ohm | OPEN | changes high-frequency path |
| `C_M` | 10 nF | 33 nF | 100 nF | OPEN | moves the dispersion/phase corner |

This includes two paper-inspired test states:

| Name | `R_E` | `R_I` | `C_M` |
| --- | ---: | ---: | ---: |
| Arm phantom A | 82.0 ohm | 82.0 ohm | 33 nF |
| Arm phantom B | 30.1 ohm | 30.1 ohm | 100 nF |

At low frequency, the capacitor impedes the intracellular branch, so the measured impedance tends toward `R_E`. At higher frequency, the capacitor passes more current and the impedance decreases toward `R_E || R_I`. The result should trace a semicircular Cole-Cole-style curve when Track B plots reactance against resistance.

## Test modes

Label the physical selector positions and record every test as `(R_E, R_I, C_M)`.

| Mode | Settings | Expected use |
| --- | --- | --- |
| Open | `R_E = OPEN`, `R_I = OPEN` | leakage, offset, saturation check |
| Pure resistor | `R_E = 100 ohm`, `R_I = OPEN` | gain and zero-phase validation |
| Arm phantom A | 82 ohm, 82 ohm, 33 nF | baseline complex-load validation |
| Arm phantom B | 30.1 ohm, 30.1 ohm, 100 nF | lower-resistance / stronger dispersion validation |
| Stress load | `R_E = 30.1 ohm`, `R_I = 30.1 ohm`, `C_M = 100 nF` | maximum current / signal-range check |
| External | connector instead of onboard circuit | compare precision components or another fixture |

For the pure-resistor test, fit a dedicated 100-ohm reference position rather than trying to combine selector values. This is the calibration truth standard.

## Connection and layout

- Use the same keyed four-terminal connector as Track A and Track B: `I+`, `V+`, `V-`, `I-`.
- Keep `V+` and `V-` as separate traces right up to the component network; this preserves the four-terminal interface even though the phantom is compact.
- Add labeled test pads at all four terminals and at the junction between `R_I` and `C_M`.
- Put the value legend on the PCB silkscreen. The selected values are part of the test data.
- Do not connect the phantom ground to USB ground or chassis; it is a floating two-terminal load.

## V2: automated phantom variation

After the manual phantom is validated, replace each selector with low-contact-resistance signal relays. Track A's reserved `CAL0`, `CAL1`, and `CAL_EN` lines can command a small relay driver. This enables repeatable automated sweeps across known phantom states and is the right proving ground for the self-calibration logic.

Use relays for the precision reference paths. A general-purpose analog switch can add several ohms of variable on-resistance, which is too large relative to a 30- or 100-ohm standard.

## Acceptance test

1. Measure every selected resistance and capacitance with a calibrated meter before soldering it to the board.
2. With Track A alone, verify 100 uA RMS into the 100-ohm position at every sweep frequency.
3. With Track B connected, capture `I_REF_OUT` and the sense voltage at each frequency.
4. Compare measured complex impedance to the equation above using the *measured* component values, not nominal labels.
5. Pass criterion for V1: magnitude error <=2% and phase error <=3 degrees for the two arm phantom states across 5-100 kHz.
6. Repeat after power cycling and after changing selectors; the result should return within the same tolerance.

If the curve is distorted, investigate in this order: incorrect component selection, current reference, phase alignment, current-driver stability, then Track B gain/ADC clipping.
