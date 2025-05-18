import { randomUUID } from "node:crypto";
import type { SQL, SQLQuery } from "bun";

import { paginate } from "../paginate.ts";
import { toSorted } from "../sort.ts";
import { type TestDataQuery, paginationTestData } from "./helpers.ts";

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
			let q: TestDataQuery<SQLQuery, "id">;

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
					"id",
				);

				expect(first3).toEqual([
					{
						id: "00000001-0000-0009-0000-000000000009",
						cursor: "00000001-0000-0009-0000-000000000009",
						hasNextPage: true,
						hasPreviousPage: false,
					},
					{
						id: "00000001-0000-0008-0000-000000000008",
						cursor: "00000001-0000-0008-0000-000000000008",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						id: "00000001-0000-0007-0000-000000000007",
						cursor: "00000001-0000-0007-0000-000000000007",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);

				expect(toSorted(first3)).toEqual(first3);
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
					"id",
				);

				expect(next3).toEqual([
					{
						id: "00000001-0000-0006-0000-000000000006",
						cursor: "00000001-0000-0006-0000-000000000006",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						id: "00000001-0000-0005-0000-000000000005",
						cursor: "00000001-0000-0005-0000-000000000005",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						id: "00000001-0000-0004-0000-000000000004",
						cursor: "00000001-0000-0004-0000-000000000004",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);

				expect(toSorted(next3)).toEqual(next3);
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
					"id",
				);

				const prev3 = await q(
					paginate({
						tableName,
						pagination: { before: "00000001-0000-0006-0000-000000000006" },
						orderBy: undefined,
						fragment: sql,
						identifier: (column) => sql(column),
					}),
					"id",
				);

				expect(prev3).toEqual(first3.toReversed());
				expect(toSorted(prev3)).toEqual(first3);
			});

			// this test ensures the sorting is not inferring with the pagination
			// (ie. that by returning the first page because of the ordering hides
			// the fact that the previous page should be actually be done thanks to
			// before/after)
			test("when called getting back to middle page", async () => {
				const prev3 = await q(
					paginate({
						tableName,
						pagination: { before: "00000001-0000-0005-0000-000000000005" },
						orderBy: undefined,
						fragment: sql,
						identifier: (column) => sql(column),
					}),
					"id",
				);

				expect(prev3).toEqual([
					{
						id: "00000001-0000-0006-0000-000000000006",
						cursor: "00000001-0000-0006-0000-000000000006",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						id: "00000001-0000-0007-0000-000000000007",
						cursor: "00000001-0000-0007-0000-000000000007",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						id: "00000001-0000-0008-0000-000000000008",
						cursor: "00000001-0000-0008-0000-000000000008",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
				expect(toSorted(prev3)).toEqual([
					{
						id: "00000001-0000-0008-0000-000000000008",
						cursor: "00000001-0000-0008-0000-000000000008",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						id: "00000001-0000-0007-0000-000000000007",
						cursor: "00000001-0000-0007-0000-000000000007",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						id: "00000001-0000-0006-0000-000000000006",
						cursor: "00000001-0000-0006-0000-000000000006",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
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
					"id",
				);

				expect(last3).toEqual([
					{
						id: "00000001-0000-0003-0000-000000000003",
						cursor: "00000001-0000-0003-0000-000000000003",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						id: "00000001-0000-0002-0000-000000000002",
						cursor: "00000001-0000-0002-0000-000000000002",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						id: "00000001-0000-0001-0000-000000000001",
						cursor: "00000001-0000-0001-0000-000000000001",
						hasNextPage: false,
						hasPreviousPage: true,
					},
				]);
				expect(toSorted(last3)).toEqual(last3);
			});
		});

		describe("given arbitrary order, asc", async () => {
			let sql: SQL;
			let tableName: string;
			let q: TestDataQuery<SQLQuery, "name">;

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
					"name",
				);

				expect(first3).toEqual([
					{
						name: "AAAA",
						cursor: "00000001-0000-0001-0000-000000000001,AAAA",
						hasNextPage: true,
						hasPreviousPage: false,
					},
					{
						name: "BBBB",
						cursor: "00000001-0000-0002-0000-000000000002,BBBB",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "CCCC",
						cursor: "00000001-0000-0003-0000-000000000003,CCCC",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
				expect(toSorted(first3, { column: "name", order: "asc" })).toEqual(
					first3,
				);
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
					"name",
				);

				expect(next3).toEqual([
					{
						name: "DDDD",
						cursor: "00000001-0000-0004-0000-000000000004,DDDD",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "EEEE",
						cursor: "00000001-0000-0005-0000-000000000005,EEEE",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "FFFF",
						cursor: "00000001-0000-0006-0000-000000000006,FFFF",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
				expect(toSorted(next3, { column: "name", order: "asc" })).toEqual(
					next3,
				);
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
					"name",
				);

				const prev3 = await q(
					paginate({
						tableName,
						pagination: { before: "00000001-0000-0004-0000-000000000004,DDDD" },
						orderBy: { column: "name", order: "asc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
					"name",
				);

				expect(prev3).toEqual(first3.toReversed());
				expect(toSorted(prev3, { column: "name", order: "asc" })).toEqual(
					first3,
				);
			});

			// this test ensures the sorting is not inferring with the pagination
			// (ie. that by returning the first page because of the ordering hides
			// the fact that the previous page should be actually be done thanks to
			// before/after)
			test("when called getting back to middle page", async () => {
				const prev3 = await q(
					paginate({
						tableName,
						pagination: { before: "00000001-0000-0005-0000-000000000005,EEEE" },
						orderBy: { column: "name", order: "asc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
					"name",
				);

				expect(prev3).toEqual(
					[
						{
							name: "BBBB",
							cursor: "00000001-0000-0002-0000-000000000002,BBBB",
							hasNextPage: true,
							hasPreviousPage: true,
						},
						{
							name: "CCCC",
							cursor: "00000001-0000-0003-0000-000000000003,CCCC",
							hasNextPage: true,
							hasPreviousPage: true,
						},
						{
							name: "DDDD",
							cursor: "00000001-0000-0004-0000-000000000004,DDDD",
							hasNextPage: true,
							hasPreviousPage: true,
						},
					].toReversed(),
				);
				expect(toSorted(prev3, { column: "name", order: "asc" })).toEqual([
					{
						name: "BBBB",
						cursor: "00000001-0000-0002-0000-000000000002,BBBB",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "CCCC",
						cursor: "00000001-0000-0003-0000-000000000003,CCCC",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "DDDD",
						cursor: "00000001-0000-0004-0000-000000000004,DDDD",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
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
					"name",
				);

				expect(last3).toEqual([
					{
						name: "GGGG",
						cursor: "00000001-0000-0007-0000-000000000007,GGGG",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "HHHH",
						cursor: "00000001-0000-0008-0000-000000000008,HHHH",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "IIII",
						cursor: "00000001-0000-0009-0000-000000000009,IIII",
						hasNextPage: false,
						hasPreviousPage: true,
					},
				]);
				expect(toSorted(last3, { column: "name", order: "asc" })).toEqual(
					last3,
				);
			});
		});

		describe("given arbitrary order, desc", async () => {
			let sql: SQL;
			let tableName: string;
			let q: TestDataQuery<SQLQuery, "name">;

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
					"name",
				);

				expect(first3).toEqual([
					{
						name: "IIII",
						cursor: "00000001-0000-0009-0000-000000000009,IIII",
						hasNextPage: true,
						hasPreviousPage: false,
					},
					{
						name: "HHHH",
						cursor: "00000001-0000-0008-0000-000000000008,HHHH",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "GGGG",
						cursor: "00000001-0000-0007-0000-000000000007,GGGG",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
				expect(toSorted(first3, { column: "name", order: "desc" })).toEqual(
					first3,
				);
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
					"name",
				);

				expect(next3).toEqual([
					{
						name: "FFFF",
						cursor: "00000001-0000-0006-0000-000000000006,FFFF",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "EEEE",
						cursor: "00000001-0000-0005-0000-000000000005,EEEE",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "DDDD",
						cursor: "00000001-0000-0004-0000-000000000004,DDDD",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
				expect(toSorted(next3, { column: "name", order: "desc" })).toEqual(
					next3,
				);
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
					"name",
				);

				const prev3 = await q(
					paginate({
						tableName,
						pagination: { before: "00000001-0000-0006-0000-000000000006,FFFF" },
						orderBy: { column: "name", order: "desc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
					"name",
				);

				expect(prev3).toEqual(first3.toReversed());
				expect(toSorted(prev3, { column: "name", order: "desc" })).toEqual(
					first3,
				);
			});

			// this test ensures the sorting is not inferring with the pagination
			// (ie. that by returning the first page because of the ordering hides
			// the fact that the previous page should be actually be done thanks to
			// before/after)
			test("when called getting back to middle page", async () => {
				const prev3 = await q(
					paginate({
						tableName,
						pagination: { before: "00000001-0000-0005-0000-000000000005,EEEE" },
						orderBy: { column: "name", order: "desc" },
						fragment: sql,
						identifier: (column) => sql(column),
					}),
					"name",
				);

				expect(prev3).toEqual(
					[
						{
							name: "HHHH",
							cursor: "00000001-0000-0008-0000-000000000008,HHHH",
							hasNextPage: true,
							hasPreviousPage: true,
						},
						{
							name: "GGGG",
							cursor: "00000001-0000-0007-0000-000000000007,GGGG",
							hasNextPage: true,
							hasPreviousPage: true,
						},
						{
							name: "FFFF",
							cursor: "00000001-0000-0006-0000-000000000006,FFFF",
							hasNextPage: true,
							hasPreviousPage: true,
						},
					].toReversed(),
				);
				expect(toSorted(prev3, { column: "name", order: "desc" })).toEqual([
					{
						name: "HHHH",
						cursor: "00000001-0000-0008-0000-000000000008,HHHH",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "GGGG",
						cursor: "00000001-0000-0007-0000-000000000007,GGGG",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "FFFF",
						cursor: "00000001-0000-0006-0000-000000000006,FFFF",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				]);
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
					"name",
				);

				expect(last3).toEqual([
					{
						name: "CCCC",
						cursor: "00000001-0000-0003-0000-000000000003,CCCC",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "BBBB",
						cursor: "00000001-0000-0002-0000-000000000002,BBBB",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "AAAA",
						cursor: "00000001-0000-0001-0000-000000000001,AAAA",
						hasNextPage: false,
						hasPreviousPage: true,
					},
				]);
				expect(toSorted(last3, { column: "name", order: "desc" })).toEqual(
					last3,
				);
			});
		});
	});
}
