import { SQL } from "bun";

import { type PaginateOptions, paginate } from "../../paginate.ts";
import { toSorted } from "../../sort.ts";
import { bunAdapter } from "../bun.ts";
import { paginationTestData, paginationTestNullData } from "./helpers.ts";

// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
const dbUrl = process.env["DB_URL"];

if (dbUrl === undefined) {
	throw new Error("DB_URL is not set");
}

const { afterAll, beforeAll, describe, expect, test } = await import(
	"bun:test"
);

async function query({
	sql,
	options,
	extraField,
}: {
	sql: SQL;
	options: PaginateOptions;
	extraField?: string;
}): Promise<unknown[]> {
	const result = paginate(options);
	const adapterResult = bunAdapter(options, result);

	const data = await sql`
			select
				${adapterResult.cursor} as "cursor",
				${adapterResult.hasNextPage} as "hasNextPage",
				${adapterResult.hasPreviousPage} as "hasPreviousPage",
				${extraField !== undefined ? sql(extraField) : sql``}
			from ${sql(options.tableName)}
			where ${adapterResult.filter}
			order by ${adapterResult.order}
			limit 3
		`;

	return data;
}

describe("bunAdapter", async () => {
	describe("given no ordering", () => {
		let sql: SQL;
		let tableName: string;

		beforeAll(async () => {
			sql = new SQL(dbUrl);
			tableName = "data-bun-no-ordering";
			await paginationTestData({
				sql: (query, ...args) => sql(query, ...args),
				tableName: sql(tableName),
			});
		});

		afterAll(async () => {
			await sql.close();
		});

		test("when called getting first page", async () => {
			const first3 = await query({
				options: {
					tableName,
					pagination: undefined,
					orderBy: undefined,
				},
				extraField: "id",
				sql,
			});

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
			const next3 = await query({
				options: {
					tableName,
					pagination: { after: "00000001-0000-0007-0000-000000000007" },
					orderBy: undefined,
				},
				extraField: "id",
				sql,
			});

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
			const first3 = await query({
				options: {
					tableName,
					pagination: undefined,
					orderBy: undefined,
				},
				extraField: "id",
				sql,
			});

			const prev3 = await query({
				options: {
					tableName,
					pagination: { before: "00000001-0000-0006-0000-000000000006" },
					orderBy: undefined,
				},
				extraField: "id",
				sql,
			});

			expect(prev3).toEqual(first3.toReversed());
			expect(toSorted(prev3)).toEqual(first3);
		});

		// this test ensures the sorting is not inferring with the pagination
		// (ie. that by returning the first page because of the ordering hides
		// the fact that the previous page should be actually be done thanks to
		// before/after)
		test("when called getting back to middle page", async () => {
			const prev3 = await query({
				options: {
					tableName,
					pagination: { before: "00000001-0000-0005-0000-000000000005" },
					orderBy: undefined,
				},
				extraField: "id",
				sql,
			});

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
			const last3 = await query({
				options: {
					tableName,
					pagination: { after: "00000001-0000-0004-0000-000000000004" },
					orderBy: undefined,
				},
				extraField: "id",
				sql,
			});

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

	describe("given arbitrary order, asc", () => {
		let sql: SQL;
		let tableName: string;

		beforeAll(async () => {
			sql = new SQL(dbUrl);
			tableName = "data-bun-arbitrary-ordering-asc";
			await paginationTestData({
				sql: (query, ...args) => sql(query, ...args),
				tableName: sql(tableName),
			});
		});

		afterAll(async () => {
			await sql.close();
		});

		test("when called getting first page", async () => {
			const first3 = await query({
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
				sql,
			});

			expect(first3).toEqual([
				{
					name: "AAAA",
					cursor: "AAAA,00000001-0000-0001-0000-000000000001",
					hasNextPage: true,
					hasPreviousPage: false,
				},
				{
					name: "BBBB",
					cursor: "BBBB,00000001-0000-0002-0000-000000000002",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "CCCC",
					cursor: "CCCC,00000001-0000-0003-0000-000000000003",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
			expect(toSorted(first3, { column: "name", order: "asc" })).toEqual(
				first3,
			);
		});

		test("when called getting second page", async () => {
			const next3 = await query({
				options: {
					tableName,
					pagination: { after: "CCCC,00000001-0000-0003-0000-000000000003" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
				sql,
			});

			expect(next3).toEqual([
				{
					name: "DDDD",
					cursor: "DDDD,00000001-0000-0004-0000-000000000004",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "EEEE",
					cursor: "EEEE,00000001-0000-0005-0000-000000000005",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "FFFF",
					cursor: "FFFF,00000001-0000-0006-0000-000000000006",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
			expect(toSorted(next3, { column: "name", order: "asc" })).toEqual(next3);
		});

		test("when called getting back to first page", async () => {
			const first3 = await query({
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
				sql,
			});

			const prev3 = await query({
				options: {
					tableName,
					pagination: { before: "DDDD,00000001-0000-0004-0000-000000000004" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
				sql,
			});

			expect(prev3).toEqual(first3.toReversed());
			expect(toSorted(prev3, { column: "name", order: "asc" })).toEqual(first3);
		});

		// this test ensures the sorting is not inferring with the pagination
		// (ie. that by returning the first page because of the ordering hides
		// the fact that the previous page should be actually be done thanks to
		// before/after)
		test("when called getting back to middle page", async () => {
			const prev3 = await query({
				options: {
					tableName,
					pagination: { before: "EEEE,00000001-0000-0005-0000-000000000005" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
				sql,
			});

			expect(prev3).toEqual(
				[
					{
						name: "BBBB",
						cursor: "BBBB,00000001-0000-0002-0000-000000000002",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "CCCC",
						cursor: "CCCC,00000001-0000-0003-0000-000000000003",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "DDDD",
						cursor: "DDDD,00000001-0000-0004-0000-000000000004",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				].toReversed(),
			);
			expect(toSorted(prev3, { column: "name", order: "asc" })).toEqual([
				{
					name: "BBBB",
					cursor: "BBBB,00000001-0000-0002-0000-000000000002",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "CCCC",
					cursor: "CCCC,00000001-0000-0003-0000-000000000003",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "DDDD",
					cursor: "DDDD,00000001-0000-0004-0000-000000000004",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
		});

		test("when called getting the last page", async () => {
			const last3 = await query({
				options: {
					tableName,
					pagination: { after: "FFFF,00000001-0000-0006-0000-000000000006" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
				sql,
			});

			expect(last3).toEqual([
				{
					name: "GGGG",
					cursor: "GGGG,00000001-0000-0007-0000-000000000007",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "HHHH",
					cursor: "HHHH,00000001-0000-0008-0000-000000000008",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "IIII",
					cursor: "IIII,00000001-0000-0009-0000-000000000009",
					hasNextPage: false,
					hasPreviousPage: true,
				},
			]);
			expect(toSorted(last3, { column: "name", order: "asc" })).toEqual(last3);
		});
	});

	describe("given arbitrary order, desc", () => {
		let sql: SQL;
		let tableName: string;

		beforeAll(async () => {
			sql = new SQL(dbUrl);
			tableName = "data-bun-arbitrary-ordering-desc";
			await paginationTestData({
				sql: (query, ...args) => sql(query, ...args),
				tableName: sql(tableName),
			});
		});

		afterAll(async () => {
			await sql.close();
		});

		test("when called getting first page", async () => {
			const first3 = await query({
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
				sql,
			});

			expect(first3).toEqual([
				{
					name: "IIII",
					cursor: "IIII,00000001-0000-0009-0000-000000000009",
					hasNextPage: true,
					hasPreviousPage: false,
				},
				{
					name: "HHHH",
					cursor: "HHHH,00000001-0000-0008-0000-000000000008",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "GGGG",
					cursor: "GGGG,00000001-0000-0007-0000-000000000007",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
			expect(toSorted(first3, { column: "name", order: "desc" })).toEqual(
				first3,
			);
		});

		test("when called getting second page", async () => {
			const next3 = await query({
				options: {
					tableName,
					pagination: { after: "GGGG,00000001-0000-0007-0000-000000000007" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
				sql,
			});

			expect(next3).toEqual([
				{
					name: "FFFF",
					cursor: "FFFF,00000001-0000-0006-0000-000000000006",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "EEEE",
					cursor: "EEEE,00000001-0000-0005-0000-000000000005",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "DDDD",
					cursor: "DDDD,00000001-0000-0004-0000-000000000004",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
			expect(toSorted(next3, { column: "name", order: "desc" })).toEqual(next3);
		});

		test("when called getting back to first page", async () => {
			const first3 = await query({
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
				sql,
			});

			const prev3 = await query({
				options: {
					tableName,
					pagination: { before: "FFFF,00000001-0000-0006-0000-000000000006" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
				sql,
			});

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
			const prev3 = await query({
				options: {
					tableName,
					pagination: { before: "EEEE,00000001-0000-0005-0000-000000000005" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
				sql,
			});

			expect(prev3).toEqual(
				[
					{
						name: "HHHH",
						cursor: "HHHH,00000001-0000-0008-0000-000000000008",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "GGGG",
						cursor: "GGGG,00000001-0000-0007-0000-000000000007",
						hasNextPage: true,
						hasPreviousPage: true,
					},
					{
						name: "FFFF",
						cursor: "FFFF,00000001-0000-0006-0000-000000000006",
						hasNextPage: true,
						hasPreviousPage: true,
					},
				].toReversed(),
			);
			expect(toSorted(prev3, { column: "name", order: "desc" })).toEqual([
				{
					name: "HHHH",
					cursor: "HHHH,00000001-0000-0008-0000-000000000008",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "GGGG",
					cursor: "GGGG,00000001-0000-0007-0000-000000000007",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "FFFF",
					cursor: "FFFF,00000001-0000-0006-0000-000000000006",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
		});

		test("when called getting the last page", async () => {
			const last3 = await query({
				options: {
					tableName,
					pagination: { after: "DDDD,00000001-0000-0004-0000-000000000004" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
				sql,
			});

			expect(last3).toEqual([
				{
					name: "CCCC",
					cursor: "CCCC,00000001-0000-0003-0000-000000000003",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "BBBB",
					cursor: "BBBB,00000001-0000-0002-0000-000000000002",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: "AAAA",
					cursor: "AAAA,00000001-0000-0001-0000-000000000001",
					hasNextPage: false,
					hasPreviousPage: true,
				},
			]);
			expect(toSorted(last3, { column: "name", order: "desc" })).toEqual(last3);
		});
	});

	describe("given arbitrary order with null values", async () => {
		let sql: SQL;
		let tableName: string;

		beforeAll(async () => {
			sql = new SQL(dbUrl);
			tableName = "data-bun-null-values";
			await paginationTestNullData({
				sql: (query, ...args) => sql(query, ...args),
				tableName: sql(tableName),
			});
		});

		afterAll(async () => {
			await sql.end();
		});

		test("when called getting first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			expect(first3).toEqual([
				{
					name: null,
					cursor: "00000001-0000-0001-0000-000000000001",
					hasNextPage: true,
					hasPreviousPage: false,
				},
				{
					name: null,
					cursor: "00000001-0000-0002-0000-000000000002",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					name: null,
					cursor: "00000001-0000-0003-0000-000000000003",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);

			expect(toSorted(first3, { column: "name", order: "asc" })).toEqual(
				first3,
			);
		});

		test("when called getting second page", async () => {
			const next3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: "00000001-0000-0003-0000-000000000003" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			expect(toSorted(next3, { column: "name", order: "asc" })).toEqual([
				{
					cursor: "00000001-0000-0004-0000-000000000004",
					hasNextPage: true,
					hasPreviousPage: true,
					name: null,
				},
				{
					cursor: "00000001-0000-0005-0000-000000000005",
					hasNextPage: true,
					hasPreviousPage: true,
					name: null,
				},
				{
					cursor: "00000001-0000-0006-0000-000000000006",
					hasNextPage: true,
					hasPreviousPage: true,
					name: null,
				},
			]);

			expect(toSorted(next3, { column: "name", order: "asc" })).toEqual(next3);
		});

		test("when called getting back to first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "id",
			});

			const first3Sorted = toSorted(first3, {
				column: "name",
				order: "asc",
			}) as [{ cursor: string }, ...{ cursor: string }[]];

			const next3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: first3Sorted.at(2)?.cursor ?? "" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "id",
			});

			const next3Sorted = toSorted(next3, {
				column: "name",
				order: "asc",
			}) as [{ cursor: string }, ...{ cursor: string }[]];

			const prev3 = await query({
				sql,
				options: {
					tableName,
					pagination: { before: next3Sorted[0].cursor },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "id",
			});
			const prev3Sorted = toSorted(prev3, { column: "name", order: "asc" });

			// In this specific case, we need to sort all the time since we can't sort ascending by name (since name is null)
			// the fallback is to sort by id in either direction, as long as we're consistent
			expect(prev3Sorted).toEqual(first3Sorted);
		});

		// this test ensures the sorting is not inferring with the pagination
		// (ie. that by returning the first page because of the ordering hides
		// the fact that the previous page should be actually be done thanks to
		// before/after)
		test("when called getting back to middle page", async () => {
			const prev3 = await query({
				sql,
				options: {
					tableName,
					pagination: { before: "00000001-0000-0005-0000-000000000005" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "id",
			});

			expect(toSorted(prev3, { column: "name", order: "asc" })).toEqual([
				{
					cursor: "00000001-0000-0002-0000-000000000002",
					hasNextPage: true,
					hasPreviousPage: true,
					id: "00000001-0000-0002-0000-000000000002",
				},
				{
					cursor: "00000001-0000-0003-0000-000000000003",
					hasNextPage: true,
					hasPreviousPage: true,
					id: "00000001-0000-0003-0000-000000000003",
				},
				{
					cursor: "00000001-0000-0004-0000-000000000004",
					hasNextPage: true,
					hasPreviousPage: true,
					id: "00000001-0000-0004-0000-000000000004",
				},
			]);
		});

		test("when called getting the last page", async () => {
			const last3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: "00000001-0000-0004-0000-000000000004" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "id",
			});

			expect(toSorted(last3, { column: "name", order: "asc" })).toEqual([
				{
					cursor: "00000001-0000-0005-0000-000000000005",
					hasNextPage: true,
					hasPreviousPage: true,
					id: "00000001-0000-0005-0000-000000000005",
				},
				{
					cursor: "00000001-0000-0006-0000-000000000006",
					hasNextPage: true,
					hasPreviousPage: true,
					id: "00000001-0000-0006-0000-000000000006",
				},
				{
					cursor: "00000001-0000-0007-0000-000000000007",
					hasNextPage: true,
					hasPreviousPage: true,
					id: "00000001-0000-0007-0000-000000000007",
				},
			]);
		});
	});
});
