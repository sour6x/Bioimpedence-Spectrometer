# Models and understandable reports

Cell Analysis and Reports now fit a single Cole dispersion to received resistance and signed reactance. Acquisition, Bluetooth/Wi-Fi transport, frequency schedules and the original fat/water calculation flow are unchanged.

## Cole fit

`Z(f) = Rinf + (R0 - Rinf) / (1 + (j f/fc)^alpha)`

The solver minimizes the sum of squared R and X residuals with equal weights. It uses variable projection for Rinf and R0-Rinf and a bounded, multi-start pattern search for fc and alpha. Constraints are R0 > Rinf > 0, 0.1 <= alpha <= 1, and fc between minimum frequency/100 and maximum frequency*100. At least six unique frequencies are required. Invalid values, positive X, duplicates and nearly flat responses are rejected.

The line covers the recorded frequency band. R0 and Rinf are extrapolated limits. Ri = R0*Rinf/(R0-Rinf); tau = 1/(2*pi*fc). An ideal-RC capacitance is shown only when alpha >= 0.995 and no fit warning exists: C = tau/(R0+Ri). Generalized Cole fits do not identify a unique ideal capacitor here. Alpha is the exponent itself; some publications use a complementary convention.

Combined RMSE = sqrt(sum(R residual squared + X residual squared)/(2*N)). Relative error divides this by mean received impedance magnitude. The 2% warning is an app engineering rule, not a clinical standard. An out-of-band peak, a frequency span below a decade, or a reached search boundary also flags limitations. No parameter confidence intervals or instrument validation are claimed. A small residual does not establish identifiability or health.

## Body composition

The existing Kyle 2001 fat-free-mass and Sun 2003 water equations remain. Fat mass is weight minus fat-free mass. Water and muscle are included in fat-free mass and must not be added as separate percentages.

Janssen 2000 adds total skeletal muscle mass:

`SMM kg = 0.401 * height_cm^2 / R50 + 3.825 * sex - 0.071 * age + 5.102`

Sex is 1 for the male equation and 0 for the female equation. Muscle estimates are withheld outside the study's 18-86 age range or when the result is nonpositive or not below fat-free mass. The current composition flow retains its pre-existing 22-94 eligibility restriction. Total SMI is SMM/height_m^2, not appendicular muscle index. The study's 2.7 kg standard error is not an individual's confidence interval. The equation underestimated muscle in Asian participants. Low muscle or sarcopenia is not diagnosed from this estimate.

BMI is weight_kg/height_m^2. CDC adult categories apply from age 20: below 18.5 underweight, 18.5 to below 25 healthy-weight BMI range, 25 to below 30 overweight, and 30 or above obesity BMI range. These are weight-for-height screening categories, not body-fat categories or a diagnosis. No universal fat or hydration percentage cutoff is invented.

## Reference context

Reports distinguish received values, fitted values, extrapolated parameters and simulated inputs. A 50 kHz clinical-convention phase angle uses atan2(-X,R). An exact received 50 kHz point is preferred; otherwise a close Cole fit bracketing 50 kHz supplies a clearly labelled model estimate. Composition retains its existing separately labelled linear interpolation; the two methods are not silently mixed.

The phase-angle reference table gives one published population example: Colombian healthy adults aged 20-29, median 7.6 degrees for males and 6.5 for females, measured seated, hand-to-foot using BiodyXpert ZM II. These medians are neither personal reference intervals nor disease cutoffs. The ESP32 and user's protocol/population have not been validated against that study. No standardized phase angle, BIVA ellipse, fluid-compartment volume or disease classification is generated.

The current ESP32 firmware generates test values. Fat, water and muscle outputs remain demonstration estimates, not actual body assessments. BMI uses the entered height and weight. Live hardware validation requires separate work.

## Evidence

- Cole parameter estimation: https://pubmed.ncbi.nlm.nih.gov/16868350/
- Population/device-specific phase references: https://pubmed.ncbi.nlm.nih.gov/16804128/
- Carrera-Gil 2026 population example: https://www.nature.com/articles/s41430-026-01744-z
- CDC adult BMI: https://www.cdc.gov/bmi/adult-calculator/
- Kyle 2001 fat-free mass: https://pubmed.ncbi.nlm.nih.gov/11312069/
- Sun 2003 water: https://pubmed.ncbi.nlm.nih.gov/12540391/
- Janssen 2000 MRI comparison: https://pubmed.ncbi.nlm.nih.gov/10926627/
- EWGSOP2 strength and sarcopenia assessment: https://pubmed.ncbi.nlm.nih.gov/30312372/

## Validation

Numerical tests recover known Cole curves for alpha 0.35, 0.65, 0.85 and 1.0, check noisy data, reject invalid/flat/duplicate/sign-invalid sweeps, and flag an out-of-band peak. Tests also check BMI boundaries, the published muscle equation and age eligibility, 50 kHz provenance, HTML escaping and self-contained export content. UI previews use isolated, visibly labelled test fixtures, never substituted into acquisition. HTML exports include the fitted plot, explanations, equations and references; JSON includes structured interpretation; CSV remains received electrical readings.

## Report presentation update
The main report and HTML download now lead with data-derived narrative, frequency and Cole plots, a plain-language fitting method and composition interpretation. The raw table is a closed appendix. Electrode-placement sections are omitted. Detailed reference comparisons remain structured JSON metadata; the readable report uses method citations without a clinical comparison table. See SIMULATION-GUIDE.md.

