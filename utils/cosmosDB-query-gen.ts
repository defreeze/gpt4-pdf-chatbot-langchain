export function generateQuery(startPage: string, goalPage: string): string {
    const query = `
      g.V().hasLabel('webpages').has('webpages', '${startPage}')
      .repeat(bothE('button').otherV())
      .until(hasLabel('webpages').has('webpages', '${goalPage}'))
      .path().by(valueMap('webpages')).by(valueMap('subLabel', 'label'))
      .limit(1)`;

    return query;
}