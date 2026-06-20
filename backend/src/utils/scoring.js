const pointsForResponse = (field, value) => {
  if (!field.maxPoints) {
    return 0;
  }

  switch (field.type) {
    case 'boolean':
      return value === true ? field.maxPoints : 0;
    case 'status':
      if (value === 'good') return field.maxPoints;
      if (value === 'low') return field.maxPoints / 2;
      return 0;
    case 'number':
      return Number(value) > 0 ? field.maxPoints : 0;
    default:
      return 0;
  }
};

export const buildChecklistResponses = (fields, answers = {}) => {
  return (fields || []).map((field) => {
    const value = answers[field.key] ?? null;
    const points = pointsForResponse(field, value);

    return {
      key: field.key,
      label: field.label,
      value,
      points,
      maxPoints: field.maxPoints,
    };
  });
};

export const computeChecklistScore = (responses) => {
  const totals = responses.reduce(
    (acc, response) => {
      acc.points += response.points;
      acc.maxPoints += response.maxPoints;
      return acc;
    },
    { points: 0, maxPoints: 0 }
  );

  if (!totals.maxPoints) {
    return 0;
  }

  return Math.round((totals.points / totals.maxPoints) * 100);
};
