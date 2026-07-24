import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface ComparisonRow {
  label: string;
  values: string[];
}

interface ComparisonTableSectionProps {
  title: string;
  columns: string[];
  rows: ComparisonRow[];
  highlightColumnIndex?: number;
}

/**
 * N 列对比表：桌面用表格，移动端用堆叠卡片。columns 是字面量（专有名词，不进 i18n），
 * rows 来自 i18n（每行 values 按 columns 下标对齐，翻译时需人工核对顺序）。
 */
export function ComparisonTableSection({
  title,
  columns,
  rows,
  highlightColumnIndex = 0,
}: ComparisonTableSectionProps) {
  return (
    <section className="py-14 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-8">{title}</h2>

        <div className="hidden md:block rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]" />
                {columns.map((column, index) => (
                  <TableHead
                    key={column}
                    className={
                      index === highlightColumnIndex
                        ? 'whitespace-normal bg-[var(--brand-fluff)] font-semibold text-foreground'
                        : 'whitespace-normal'
                    }
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="whitespace-normal align-top font-medium text-foreground">{row.label}</TableCell>
                  {row.values.map((value, index) => (
                    <TableCell
                      key={columns[index]}
                      className={
                        index === highlightColumnIndex
                          ? 'whitespace-normal align-top bg-[var(--brand-fluff)]/60 text-foreground'
                          : 'whitespace-normal align-top text-muted-foreground'
                      }
                    >
                      {value}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-4 md:hidden">
          {rows.map((row) => (
            <div key={row.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-3">{row.label}</p>
              <dl className="space-y-2">
                {row.values.map((value, index) => (
                  <div
                    key={columns[index]}
                    className={`rounded-md px-3 py-2 ${
                      index === highlightColumnIndex
                        ? 'border border-[var(--brand-corgi)] bg-[var(--brand-fluff)]'
                        : 'bg-muted/40'
                    }`}
                  >
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{columns[index]}</dt>
                    <dd
                      className={
                        index === highlightColumnIndex ? 'font-medium text-foreground' : 'text-muted-foreground'
                      }
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
