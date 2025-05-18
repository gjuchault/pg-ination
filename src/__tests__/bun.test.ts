import { randomUUID } from "node:crypto";
import type { SQL, SQLQuery } from "bun";

import { type PaginateResult, paginate } from "../index.ts";
import { paginationTestData } from "./helpers.ts";

if ("bun" in process.versions) {
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
	const dbUrl = process.env["DB_URL"];

	if (dbUrl === undefined) {
		throw new Error("DB_URL is not set");
	}

	const { afterAll, beforeAll, describe, expect, test } = await import(
		"bun:test"
	);
	const { SQL } = await import("bun");

	describe("paginate()", async () => {
		describe("given no ordering", async () => {
			let sql: SQL;
			let tableName: string;
			let q: (
				query: PaginateResult<SQLQuery>,
			) => Promise<
				{ cursor: string; hasNextPage: boolean; hasPreviousPage: boolean }[]
			>;

			beforeAll(async () => {
				sql = new SQL(dbUrl);
				tableName = `data-${randomUUID()}`;
				q = await paginationTestData(sql, tableName);
			});

			afterAll(async () => {
				await sql.close();
			});

			test("when called getting first page", async () => {
				const first3 = await q(
					paginate<SQL, SQLQuery, SQLQuery>({
						tableName,
						pagination: undefined,
						orderBy: undefined,
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(first3).toEqual([
					{
						cursor: "00000001-0000-0009-0000-000000000009",
						hasNextPage: true,
						hasPreviousPage: false,
					},
					{
						cursor: "00000001-0000-0008-0000-000000000008",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0007-0000-000000000007",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
			});

			test("when called getting second page", async () => {
				const next3 = await q(
					paginate({
						tableName,
						pagination: { after: "00000001-0000-0007-0000-000000000007" },
						orderBy: undefined,
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(next3).toEqual([
					{
						cursor: "00000001-0000-0006-0000-000000000006",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0005-0000-000000000005",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0004-0000-000000000004",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
			});

			test("when called getting back to first page", async () => {
				const first3 = await q(
					paginate<SQL, SQLQuery, SQLQuery>({
						tableName,
						pagination: undefined,
						orderBy: undefined,
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				const prev3 = await q(
					paginate({
						tableName,
						pagination: { before: "00000001-0000-0006-0000-000000000006" },
						orderBy: undefined,
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(prev3).toEqual(first3);
			});

			test("when called getting the last page", async () => {
				const last3 = await q(
					paginate({
						tableName,
						pagination: { after: "00000001-0000-0004-0000-000000000004" },
						orderBy: undefined,
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(last3).toEqual([
					{
						cursor: "00000001-0000-0003-0000-000000000003",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0002-0000-000000000002",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0001-0000-000000000001",
						hasNextPage: false,
						hasPreviousPage: true,
					},
				]);
			});
		});

		describe("given arbitrary order, asc", async () => {
			let sql: SQL;
			let tableName: string;
			let q: (
				query: PaginateResult<SQLQuery>,
			) => Promise<
				{ cursor: string; hasNextPage: boolean; hasPreviousPage: boolean }[]
			>;

			beforeAll(async () => {
				sql = new SQL(dbUrl);
				tableName = `data-${randomUUID()}`;
				q = await paginationTestData(sql, tableName);
			});

			afterAll(async () => {
				await sql.close();
			});

			test("when called getting first page", async () => {
				const first3 = await q(
					paginate({
						tableName,
						pagination: undefined,
						orderBy: { column: "name", order: "asc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(first3).toEqual([
					{
						cursor: "00000001-0000-0001-0000-000000000001,AAAA",
						hasNextPage: true,
						hasPreviousPage: false,
					},
					{
						cursor: "00000001-0000-0002-0000-000000000002,BBBB",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0003-0000-000000000003,CCCC",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
			});

			test("when called getting second page", async () => {
				const next3 = await q(
					paginate({
						tableName,
						pagination: { after: "00000001-0000-0003-0000-000000000003,CCCC" },
						orderBy: { column: "name", order: "asc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(next3).toEqual([
					{
						cursor: "00000001-0000-0004-0000-000000000004,DDDD",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0005-0000-000000000005,EEEE",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0006-0000-000000000006,FFFF",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
			});

			test("when called getting back to first page", async () => {
				const first3 = await q(
					paginate({
						tableName,
						pagination: undefined,
						orderBy: { column: "name", order: "asc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				const prev3 = await q(
					paginate({
						tableName,
						pagination: { before: "00000001-0000-0005-0000-000000000005,EEEE" },
						orderBy: { column: "name", order: "asc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(prev3).toEqual(first3);
			});

			test("when called getting the last page", async () => {
				const last3 = await q(
					paginate({
						tableName,
						pagination: { after: "00000001-0000-0006-0000-000000000006,FFFF" },
						orderBy: { column: "name", order: "asc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(last3).toEqual([
					{
						cursor: "00000001-0000-0007-0000-000000000007,GGGG",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0008-0000-000000000008,HHHH",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0009-0000-000000000009,IIII",
						hasNextPage: false,
						hasPreviousPage: true,
					},
				]);
			});
		});

		describe("given arbitrary order, desc", async () => {
			let sql: SQL;
			let tableName: string;
			let q: (
				query: PaginateResult<SQLQuery>,
			) => Promise<
				{ cursor: string; hasNextPage: boolean; hasPreviousPage: boolean }[]
			>;

			beforeAll(async () => {
				sql = new SQL(dbUrl);
				tableName = `data-${randomUUID()}`;
				q = await paginationTestData(sql, tableName);
			});

			afterAll(async () => {
				await sql.close();
			});

			test("when called getting first page", async () => {
				const first3 = await q(
					paginate({
						tableName,
						pagination: undefined,
						orderBy: { column: "name", order: "desc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(first3).toEqual([
					{
						cursor: "00000001-0000-0009-0000-000000000009,IIII",
						hasNextPage: true,
						hasPreviousPage: false,
					},
					{
						cursor: "00000001-0000-0008-0000-000000000008,HHHH",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0007-0000-000000000007,GGGG",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
			});

			test("when called getting second page", async () => {
				const next3 = await q(
					paginate({
						tableName,
						pagination: { after: "00000001-0000-0007-0000-000000000007,GGGG" },
						orderBy: { column: "name", order: "desc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(next3).toEqual([
					{
						cursor: "00000001-0000-0006-0000-000000000006,FFFF",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0005-0000-000000000005,EEEE",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0004-0000-000000000004,DDDD",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
			});

			test("when called getting back to first page", async () => {
				const first3 = await q(
					paginate({
						tableName,
						pagination: undefined,
						orderBy: { column: "name", order: "desc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				const prev3 = await q(
					paginate({
						tableName,
						pagination: { before: "00000001-0000-0005-0000-000000000005,EEEE" },
						orderBy: { column: "name", order: "desc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(prev3).toEqual(first3);
			});

			test("when called getting the last page", async () => {
				const last3 = await q(
					paginate({
						tableName,
						pagination: { after: "00000001-0000-0004-0000-000000000004,DDDD" },
						orderBy: { column: "name", order: "desc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
				);

				expect(last3).toEqual([
					{
						cursor: "00000001-0000-0003-0000-000000000003,CCCC",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0002-0000-000000000002,BBBB",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						cursor: "00000001-0000-0001-0000-000000000001,AAAA",
						hasNextPage: false,
						hasPreviousPage: true,
					},
				]);
			});
		});
	});
}
