# BIS Wearable: app simulation and presentation guide

## The one-sentence description

“Our app receives a simulated multi-frequency impedance sweep, explains its electrical response, fits a Cole model, and demonstrates published body-composition calculations using a profile.”

This guide covers the software. Your teammate can explain the hardware. The present firmware generates test electrical values; the demonstration does not measure a person's tissue. The displayed results are not randomized independently inside the web app: they are calculated from the received electrical values and the entered profile.

## A useful presentation flow

1. **Input:** show the incoming sweep and the profile used for composition.
2. **Electrical quantities:** explain resistance, reactance, impedance and phase.
3. **Frequency response:** explain the direction and size of the impedance change.
4. **Cole plot:** explain the received dots and the fitted curve.
5. **Model fitting:** describe how the app finds and checks the curve.
6. **Composition:** explain fat, water, muscle and BMI as separate calculations.
7. **Report:** show the plain-language finding, with technical readings tucked into an appendix.

## 1. What the app receives

The configured sweep has 11 frequencies: 4, 8, 10, 16, 20, 30, 40, 60, 80, 100 and 120 kHz. The app accepts numbered packets and retains each sample. Bluetooth and Wi-Fi transport the electrical data; the analysis does not require changing the frequency schedule.

At each frequency, the core quantities are resistance R and signed reactance X, in ohms. The current firmware also calculates phase. Its values are generated from a noisy RC-shaped response, rather than acquired from tissue. The app's Bluetooth decoder derives impedance magnitude from received R and X; Wi-Fi receives the firmware's calculated impedance.

Height and weight do not control this simulated electrical response. They are inputs to the profile and composition calculations.

## 2. What each reading means

| Reading | Meaning | Calculation or origin |
|---|---|---|
| Frequency f | How many electrical cycles occur per second | Configured sweep value, in Hz |
| Resistance R | Resistive opposition along the electrical path | Received value, in Ω |
| Reactance X | Reactive, capacitive part of the electrical response | Received value, in Ω; negative for this convention |
| Impedance magnitude | Overall opposition combining R and X | `|Z| = sqrt(R² + X²)` |
| Signed phase | Angle between voltage and current | `phase = atan2(X, R) × 180/pi` |

For example, your supplied simulated report has R ≈ 588.18 Ω and X ≈ −110.10 Ω at 40 kHz. These give |Z| ≈ 598.40 Ω and signed phase ≈ −10.60°. Some clinical literature reports the positive capacitive phase-angle magnitude instead; sign conventions must be stated when comparing.

**Say:** “Impedance combines resistance and reactance. Phase represents their angular relationship; it is not a direct cell count or a health percentage.”

## 3. What the frequency graph and slope mean

The frequency graph plots frequency horizontally and impedance magnitude vertically. Each point represents a different frequency, not a change in the body over time.

In the supplied simulation, impedance falls from about **697.0 Ω at 4 kHz to 503.7 Ω at 120 kHz**: a **27.7% decrease**.

The report calculates:

`percentage change = 100 × (last impedance − first impedance) / first impedance`

`average endpoint slope = (last impedance − first impedance) / log10(last frequency / first frequency)`

For this example, the slope is about **−130.9 Ω per decade**. A decade means a tenfold increase in frequency. This summarizes the endpoints over the recorded band. It is not a linear-regression slope or a claim that the whole curve is straight. The app graph uses a linear frequency axis; the downloadable report uses a logarithmic frequency axis and labels it explicitly.

The falling response is compatible with a capacitive circuit. In a simplified tissue model, membranes oppose low-frequency current more strongly; higher frequencies allow greater contribution from intracellular paths. In this simulation, the pattern comes from the generated RC response. It does not prove a real person's membranes or hydration are normal.

**Say:** “The downward trend demonstrates frequency-dependent opposition. Our software describes its size and direction, rather than showing the readings without explanation.”

## 4. What the Cole–Cole plot means

The horizontal axis is R. The vertical axis is −X, so capacitive reactance appears above the axis. Each dot is a received frequency sample. The line is the model fitted to those dots; it is not a clinical normal curve.

As frequency increases, the simulated points generally move from the higher-resistance right side toward the lower-resistance left side. Their curved path represents resistive and capacitive behavior together.

The app uses this convention:

`Z(f) = R∞ + (R0 − R∞) / [1 + (j f/fc)^alpha]`

Here Z is complex impedance, `R + jX`, and `j² = −1`.

| Parameter | Explain it this way |
|---|---|
| R0 | The model's theoretical zero-frequency resistance limit; extrapolated, not measured at zero Hz |
| R∞ | The theoretical infinite-frequency resistance limit; the highest recorded frequency is not infinity |
| fc | Frequency of the fitted reactance-magnitude peak; it need not be the maximum-phase frequency |
| alpha | Arc-shape exponent; 1 is the ideal single-time-constant case, lower values broaden the response |

This app uses alpha as the exponent. Other software sometimes uses `1 − alpha`, so compare equations before comparing parameter values.

## 5. How the fitting actually works

1. Reject invalid data, duplicate frequencies, positive X under the current capacitive convention, and nearly flat responses. Require at least six unique frequencies.
2. Try several starting values for peak frequency and alpha.
3. For each pair, solve the resistance terms using linear least squares. This is called variable projection.
4. Refine peak frequency and alpha using bounded pattern search from multiple starts. Choose the solution with the smallest combined residual sum of squares.
5. Check whether the fitted peak lies in the recorded band, whether the search reached a boundary, and how closely the model follows the points.

The minimized objective is:

`sum over samples [(R_model − R_received)² + (X_model − X_received)²]`

R and X receive equal weight. Constraints enforce `R0 > R∞ > 0` and `0.1 <= alpha <= 1`; the peak-frequency search spans minimum frequency/100 through maximum frequency×100.

`RMSE = sqrt(objective / (2 × number of samples))`

`relative fitting error = 100 × RMSE / mean received impedance magnitude`

Your supplied simulation fits approximately **R0 = 699.09 Ω, R∞ = 479.03 Ω, fc = 39.28 kHz, alpha = 1.000**. Combined RMSE is about **0.60 Ω**, or **0.10%** of mean impedance. These values are recomputed from the readings, not hardcoded into reports.

The app flags errors above 2% as an engineering check. That threshold is not a clinical standard. A small residual means the curve matches these data; it does not establish sensor accuracy or a health outcome. No confidence intervals are estimated.

**Say:** “We search for the Cole curve that best explains both R and X, then report the residual error and any limitations.”

## 6. How composition is calculated

The composition section has its own profile and sweep. It uses height in cm, weight in kg, age and the selected equation sex coefficient. It retains the original model eligibility and plausibility checks.

These equations require a 50 kHz input. The configured sweep does not include 50 kHz, so the app explicitly interpolates between 40 and 60 kHz when allowed:

`t = (50000 − lower frequency) / (upper frequency − lower frequency)`

`R50 = Rlower + t × (Rupper − Rlower)`

The same interpolation is applied to signed X. For your supplied sweep, **R50 ≈ 566.04 Ω and X50 ≈ −105.30 Ω**. These are estimated inputs, not an extra received packet. Composition uses this linear interpolation; it does not silently replace it with the Cole prediction.

Let `I = height_cm² / R50`, and let `S = 1` for the male coefficient or `0` for the female coefficient. The positive capacitive magnitude for the fat-free-mass equation is `Xc50 = −X50`.

### Fat: Kyle 2001

`FFM kg = −4.104 + 0.518 × I + 0.231 × weight + 0.130 × Xc50 + 4.229 × S`

`fat mass = weight − FFM`

`fat percentage = 100 × fat mass / weight`

FFM is fat-free mass. It includes water, muscle, organs and bone; it is not muscle alone.

### Water: Sun 2003

Male coefficient:

`TBW L = 1.203 + 0.449 × I + 0.176 × weight`

Female coefficient:

`TBW L = 3.747 + 0.450 × I + 0.113 × weight`

`water percentage ≈ 100 × TBW / weight`, using approximately 1 kg/L for water.

### Skeletal muscle: Janssen 2000

`muscle kg = 0.401 × I + 3.825 × S − 0.071 × age + 5.102`

`total skeletal muscle index = muscle kg / height_m²`

This estimates total skeletal muscle, not appendicular muscle or strength. The app withholds a muscle result outside the study's 18–86 age range or for an incompatible compartment estimate. The study reported a 2.7 kg standard error and underestimated muscle in Asian participants; that error is not an individual confidence interval.

### BMI

`BMI = weight_kg / height_m²`

For adults aged 20 and over: below 18.5 is underweight; 18.5 to below 25 is the healthy-weight BMI range; 25 to below 30 is overweight; 30 and above is the obesity BMI range. These are weight-for-height screening categories, not body-fat classifications.

### Example from your supplied simulation

For **165 cm, 78 kg, age 22, male coefficient**, the app calculates:

- BMI **28.7**, in the adult overweight BMI category.
- Fat-free mass **56.7 kg**.
- Fat mass **21.3 kg**, approximately **27.2%**.
- Total body water **36.5 L**, approximately **46.8%**.
- Skeletal muscle approximately **26.7 kg**.

These are demonstration outputs for that profile and sweep. Water and muscle are contained within fat-free mass. Do not add their percentages to fat-free mass or treat them as independent compartments. The software does not assign a universal healthy/unhealthy label to fat, water or muscle without a suitable reference.

## 7. A short closing explanation for the demo

“The simulation produces a frequency-dependent electrical response. The app makes this understandable by explaining the impedance trend, fitting a Cole model to both resistance and reactance, and showing the fitting error. It then applies published equations to demonstrate composition estimates from the profile and 50 kHz inputs. The report describes the calculated findings in plain language, with the raw data available as an optional appendix. The same analysis can later receive calibrated hardware data, with units, sign convention and model suitability verified during validation.”

## Sources

- [Cole parameter fitting and equivalent-circuit interpretation](https://pubmed.ncbi.nlm.nih.gov/16868350/)
- [Kyle 2001: fat-free mass equation](https://pubmed.ncbi.nlm.nih.gov/11312069/)
- [Sun 2003: water prediction](https://pubmed.ncbi.nlm.nih.gov/12540391/)
- [Published application of the water equations](https://pmc.ncbi.nlm.nih.gov/articles/PMC2877506/)
- [Janssen 2000: skeletal muscle compared with MRI](https://pubmed.ncbi.nlm.nih.gov/10926627/)
- [CDC adult BMI categories](https://www.cdc.gov/bmi/adult-calculator/)
