import ChecklistItem from '../models/ChecklistItem.js';
import { getChecklistTemplate } from '../config/checklistTemplates.js';

// Resolves the checklist fields shown to (and scored for) an employee of the
// given role. Admin-managed items in the DB are authoritative; if a role has
// no items at all yet, we fall back to the built-in default template so the
// employee experience never breaks before the admin customises anything.
export const resolveChecklistFields = async (role) => {
  const items = await ChecklistItem.find({ role }).sort({ order: 1, createdAt: 1 });

  if (items.length) {
    return items
      .filter((item) => item.active)
      .map((item) => ({
        key: item.key,
        label: item.label,
        type: item.type,
        maxPoints: item.maxPoints,
      }));
  }

  return getChecklistTemplate(role);
};
