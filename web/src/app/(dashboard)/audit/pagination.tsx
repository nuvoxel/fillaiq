"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Pagination from "@mui/material/Pagination";

export function AuditPagination({
  totalPages,
  currentPage,
}: {
  totalPages: number;
  currentPage: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(_: React.ChangeEvent<unknown>, page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`?${params.toString()}`);
  }

  return (
    <Pagination
      count={totalPages}
      page={currentPage}
      onChange={handleChange}
      color="primary"
      shape="rounded"
    />
  );
}
