import { MEAL_POLICY_LINES } from '../lib/stayInfo';

function MealPolicyList({ className = 'list-disc space-y-1 pl-4' }) {
  return (
    <ul className={className}>
      {MEAL_POLICY_LINES.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

export default MealPolicyList;

