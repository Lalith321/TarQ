export interface LineChartSeries {
  key: string;
  name: string;
}

export interface LineChartModel {
  data: Record<string, unknown>[];
  series: LineChartSeries[];
  labels: string[];
}

function numericValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function identity(value: unknown): string {
  return `${typeof value}:${String(value)}`;
}

export function buildLineChartModel(
  rows: Record<string, unknown>[],
  xField: string,
  yField: string | string[] | undefined,
  groupBy?: string,
): LineChartModel {
  const yFields = Array.isArray(yField) ? yField : [yField ?? 'value'];
  const hasGroupValues = Boolean(groupBy && rows.some((row) => groupBy in row));

  if (!hasGroupValues || !groupBy) {
    const series = yFields.map((field) => ({ key: field, name: field }));
    const data = rows.map((row) => ({
      ...row,
      ...Object.fromEntries(yFields.map((field) => [field, numericValue(row[field])])),
    }));
    return { data, series, labels: rows.map((row) => String(row[xField] ?? '')) };
  }

  const groups = new Map<string, { id: string; label: string }>();
  const categories = new Map<string, unknown>();
  for (const row of rows) {
    const groupValue = row[groupBy];
    const groupId = identity(groupValue);
    if (!groups.has(groupId)) groups.set(groupId, { id: groupId, label: String(groupValue ?? 'Unknown') });
    const categoryValue = row[xField];
    const categoryId = identity(categoryValue);
    if (!categories.has(categoryId)) categories.set(categoryId, categoryValue);
  }

  const series = Array.from(groups.values()).flatMap((group, groupIndex) =>
    yFields.map((field, fieldIndex) => {
      const index = groupIndex * yFields.length + fieldIndex;
      return {
        key: `__line_${index}`,
        name: yFields.length === 1 ? group.label : `${group.label} / ${field}`,
      };
    }),
  );
  const seriesKeys = new Map<string, string>();
  let seriesIndex = 0;
  for (const group of groups.values()) {
    for (const field of yFields) {
      seriesKeys.set(`${group.id}\u0000${field}`, series[seriesIndex].key);
      seriesIndex += 1;
    }
  }

  const dataByCategory = new Map<string, Record<string, unknown>>();
  for (const [categoryId, categoryValue] of categories) {
    dataByCategory.set(categoryId, {
      [xField]: categoryValue,
      ...Object.fromEntries(series.map(({ key }) => [key, null])),
    });
  }
  for (const row of rows) {
    const groupId = identity(row[groupBy]);
    const categoryId = identity(row[xField]);
    const chartRow = dataByCategory.get(categoryId)!;
    for (const field of yFields) {
      const key = seriesKeys.get(`${groupId}\u0000${field}`)!;
      chartRow[key] = numericValue(row[field]);
    }
  }

  return {
    data: Array.from(dataByCategory.values()),
    series,
    labels: Array.from(categories.values(), (value) => String(value ?? '')),
  };
}