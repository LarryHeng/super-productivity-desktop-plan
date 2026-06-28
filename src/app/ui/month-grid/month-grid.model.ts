export interface MonthGridItem {
  id: string;
  title: string;
  meta?: string;
}

export interface MonthGridDay {
  dayDate: string;
  total?: string;
  isOverdue?: boolean;
  items: MonthGridItem[];
}
