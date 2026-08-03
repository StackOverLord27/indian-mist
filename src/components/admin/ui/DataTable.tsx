import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  emptyMessage?: string;
}

export default function DataTable<T extends Record<string, any>>({ 
  columns, 
  data, 
  isLoading, 
  emptyMessage = "No data found." 
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="border border-olive/10 rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-warm">
            <TableRow className="border-olive/10">
              {columns.map((col) => (
                <TableHead key={col.key} style={{ width: col.width }} className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60/70">
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map((i) => (
              <TableRow key={i} className="border-b border-olive/8 hover:bg-warm/50 transition-colors">
                {columns.map((col) => (
                  <TableCell key={col.key} className="py-3 px-4">
                    <Skeleton className="h-4 w-full bg-olive/10" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="border border-olive/10 rounded-md overflow-hidden bg-card">
      <Table>
        <TableHeader className="bg-warm">
          <TableRow className="border-olive/10">
            {columns.map((col) => (
              <TableHead key={col.key} style={{ width: col.width }} className="font-montserrat text-[10px] uppercase tracking-wider text-forest/60/70">
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center font-montserrat text-sm text-forest/60 py-12">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => (
              <TableRow key={i} className="border-b border-olive/8 hover:bg-warm/50 transition-colors">
                {columns.map((col) => (
                  <TableCell key={col.key} className="font-montserrat text-sm text-forest py-3 px-4">
                    {/* eslint-disable-next-line @typescript-eslint/no-unsafe-return */}
                    {col.render ? col.render(row) : row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
