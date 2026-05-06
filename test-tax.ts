import { calculateOptimization, defaultFederalBrackets, defaultProvincialBrackets, DEFAULT_QUEBEC_ABATEMENT } from './src/utils/taxEngine.js';

const result = calculateOptimization(126763, 130726, 22100, {
  federalBrackets: defaultFederalBrackets,
  provincialBrackets: defaultProvincialBrackets,
  abatement: DEFAULT_QUEBEC_ABATEMENT
});

console.log(JSON.stringify(result, null, 2));
