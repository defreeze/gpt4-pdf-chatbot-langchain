export function generateQuery(startPage: string, goalPage: string): string {
  const query = `
      g.V().hasLabel('waypostDEMO').has('waypostDEMO', '${startPage}')
      .repeat(bothE('button').otherV())
      .until(hasLabel('waypostDEMO').has('waypostDEMO', '${goalPage}'))
      .path().by(valueMap('waypostDEMO')).by(valueMap('subLabel', 'label'))
      .limit(1)`;

  return query;
}