// Checklist field types:
// - boolean: simple yes/no, scoreable when maxPoints > 0 (yes = full points)
// - status: 'good' | 'low' | 'empty' (good = full points, low = half, empty = 0)
// - number: numeric count, scoreable when maxPoints > 0 (>0 = full points)
// - text: free text, informational only (maxPoints always 0)

const POINTS = 4;

export const HOUSEKEEPING_CHECKLIST = [
  { key: 'drinkingWater', label: 'Drinking water filled?', type: 'boolean', maxPoints: POINTS },
  { key: 'hotWaterKettle', label: 'Hot water in kettle?', type: 'boolean', maxPoints: POINTS },
  { key: 'waterTankFilled', label: 'Water tank filled?', type: 'boolean', maxPoints: POINTS },
  { key: 'guestFootwearSet', label: 'Guest footwear set?', type: 'boolean', maxPoints: POINTS },
  { key: 'toiletRollCount', label: 'Toilet roll count?', type: 'number', maxPoints: POINTS },
  { key: 'showerGelStatus', label: 'Shower gel status?', type: 'status', maxPoints: POINTS },
  { key: 'handWashStatus', label: 'Hand wash status?', type: 'status', maxPoints: POINTS },
  { key: 'lightWorking', label: 'Light working?', type: 'boolean', maxPoints: POINTS },
  { key: 'fanWorking', label: 'Fan working?', type: 'boolean', maxPoints: POINTS },
  { key: 'furnitureBreakage', label: 'Furniture breakage?', type: 'boolean', maxPoints: 0 },
  { key: 'bathroomDamage', label: 'Bathroom damage?', type: 'boolean', maxPoints: 0 },
  { key: 'damageIssuesReported', label: 'Damage/issues reported?', type: 'text', maxPoints: 0 },
  { key: 'guestItemsLeft', label: 'Guest items left?', type: 'text', maxPoints: 0 },
  { key: 'kitchenCleaned', label: 'Kitchen cleaned?', type: 'boolean', maxPoints: POINTS },
  { key: 'kitchenSink', label: 'Kitchen sink?', type: 'boolean', maxPoints: POINTS },
  { key: 'dustbinsCleaned', label: 'Dustbins cleaned?', type: 'boolean', maxPoints: POINTS },
  { key: 'dustingShowcaseShop', label: 'Dusting showcase & shop?', type: 'boolean', maxPoints: POINTS },
  { key: 'morningMop', label: 'Morning mop?', type: 'boolean', maxPoints: POINTS },
  { key: 'noonMop', label: 'Noon mop?', type: 'boolean', maxPoints: POINTS },
  { key: 'eveningMop', label: 'Evening mop?', type: 'boolean', maxPoints: POINTS },
  { key: 'campfireLogs', label: 'Logs for campfire area?', type: 'boolean', maxPoints: POINTS },
  { key: 'outsideClean', label: 'Outside clean?', type: 'boolean', maxPoints: POINTS },
  { key: 'guestPhotos', label: 'Guest photos if any?', type: 'text', maxPoints: 0 },
  { key: 'tipsCollected', label: 'Any tips collected?', type: 'text', maxPoints: 0 },
  { key: 'nailsTrimmed', label: 'Nails trimmed?', type: 'boolean', maxPoints: POINTS },
  { key: 'anyLearnings', label: 'Any learnings?', type: 'text', maxPoints: 0 },
];

export const KITCHEN_CHECKLIST = [
  { key: 'removeMilkFromFreezer', label: 'Remove milk from Freezer', type: 'boolean', maxPoints: POINTS },
  { key: 'waterTankFill', label: 'Water Tank fill', type: 'boolean', maxPoints: POINTS },
  { key: 'cookRice', label: 'Cook rice (Staff & Guests)', type: 'boolean', maxPoints: POINTS },
  { key: 'washKitchenClothes', label: 'Wash Kitchen clothes', type: 'boolean', maxPoints: POINTS },
  { key: 'breakfastBuffetSetup', label: 'Breakfast buffet setup', type: 'boolean', maxPoints: POINTS },
  { key: 'kitchenCleaningMorning', label: 'Kitchen cleaning (morning)', type: 'boolean', maxPoints: POINTS },
  { key: 'washUtensilsMorning', label: 'Wash utensils (morning)', type: 'boolean', maxPoints: POINTS },
  { key: 'cutVegetablesLunch', label: 'Cut vegetables (lunch)', type: 'boolean', maxPoints: POINTS },
  { key: 'lunchPreparation', label: 'Lunch preparation', type: 'boolean', maxPoints: POINTS },
  { key: 'buffetSetupLunch', label: 'Buffet setup for lunch', type: 'boolean', maxPoints: POINTS },
  { key: 'cleanMixerGrinderStoveGrater', label: 'Clean mixer / grinder / stove / Coconut grater', type: 'boolean', maxPoints: POINTS },
  { key: 'cleanShelvesFloor', label: 'Clean shelves & floor', type: 'boolean', maxPoints: POINTS },
  { key: 'disposeWetWaste', label: 'Dispose wet waste', type: 'boolean', maxPoints: POINTS },
  { key: 'fridgeCleaning', label: 'Fridge Cleaning', type: 'boolean', maxPoints: POINTS },
  { key: 'eveningSnackPreparation', label: 'Evening snack preparation', type: 'boolean', maxPoints: POINTS },
  { key: 'dinnerPreparation', label: 'Dinner preparation', type: 'boolean', maxPoints: POINTS },
  { key: 'dinnerSetup', label: 'Dinner setup', type: 'boolean', maxPoints: POINTS },
  { key: 'fullKitchenCleaningNight', label: 'Full kitchen cleaning (night)', type: 'boolean', maxPoints: POINTS },
  { key: 'breakfastPlanNextDay', label: 'Breakfast plan for next day (Soaking)', type: 'boolean', maxPoints: POINTS },
  { key: 'deepCleaningTue', label: 'Deep Cleaning – Platform, Stove, storage (Tue)', type: 'boolean', maxPoints: POINTS },
  { key: 'cleanWashingAreaTiles', label: 'Clean the Washing area tiles and floor', type: 'boolean', maxPoints: POINTS },
  { key: 'weeklyFloorDetergentWashTue', label: 'Weekly Floor Detergent Wash (Tue)', type: 'boolean', maxPoints: POINTS },
  { key: 'damageIssuesReported', label: 'Damage/issues reported?', type: 'text', maxPoints: 0 },
  { key: 'campfireLogs', label: 'Logs for campfire area?', type: 'boolean', maxPoints: POINTS },
  { key: 'tipsCollected', label: 'Any tips collected?', type: 'text', maxPoints: 0 },
  { key: 'nailsTrimmed', label: 'Nails trimmed?', type: 'boolean', maxPoints: POINTS },
  { key: 'anyLearnings', label: 'Any learnings?', type: 'text', maxPoints: 0 },
];

export const getChecklistTemplate = (type) =>
  type === 'kitchen' ? KITCHEN_CHECKLIST : HOUSEKEEPING_CHECKLIST;
