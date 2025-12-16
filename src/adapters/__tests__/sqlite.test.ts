import { deepEqual } from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";

import { type PaginateOptions, paginate } from "../../paginate.ts";
import { toSorted } from "../../sort.ts";
import { sqliteAdapter } from "../sqlite.ts";
import {
	paginationTestData,
	paginationTestDataWithAmount,
	paginationTestDataWithDate,
} from "./helpers.ts";

function getClient(): DatabaseSync {
	return new DatabaseSync(":memory:");
}

type QueryResult<ExtraField extends string | undefined> = {
	cursor: string;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
} & { [Key in Exclude<ExtraField, undefined>]: string | null };

async function query<ExtraField extends string | undefined>({
	sql,
	options,
	extraField,
}: {
	sql: DatabaseSync;
	options: PaginateOptions;
	extraField?: ExtraField;
}): Promise<QueryResult<ExtraField>[]> {
	const result = paginate(options);
	const adapterResult = sqliteAdapter(options, result);

	const data = sql
		.prepare(`
				select
					${extraField !== undefined ? `${extraField},` : ""}
					${adapterResult.cursor} as "cursor",
					${adapterResult.hasNextPage} as "hasNextPage",
					${adapterResult.hasPreviousPage} as "hasPreviousPage"
				from ${options.tableName}
				where ${adapterResult.filter}
				order by ${adapterResult.order}
				limit 3
			`)
		.all();

	// create a new object to avoid having null prototype objects
	return Array.from(data).map((row) => ({
		...row,
	})) as QueryResult<ExtraField>[];
}

await describe("postgresAdapter", async () => {
	await describe("given no ordering", async () => {
		let sql: DatabaseSync;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data_postgres_no_ordering";
			await paginationTestData<string, string>({
				sql(strings, ...parts) {
					const fullQuery = strings.reduce((acc, str, i) => {
						if (parts.length > i) {
							return acc + str + (parts[i] ?? "null");
						}

						return acc + str;
					}, "");

					return Promise.resolve(sql.prepare(fullQuery).all());
				},
				tableName,
			});
		});

		after(async () => {
			await sql.close();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: undefined,
				},
				extraField: "id",
			});

			deepEqual(first3, [
				{
					id: "00000001-0000-0009-0000-000000000009",
					cursor: "00000001-0000-0009-0000-000000000009",
					hasNextPage: 1,
					hasPreviousPage: 0,
				},
				{
					id: "00000001-0000-0008-0000-000000000008",
					cursor: "00000001-0000-0008-0000-000000000008",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					id: "00000001-0000-0007-0000-000000000007",
					cursor: "00000001-0000-0007-0000-000000000007",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);

			deepEqual(toSorted(first3), first3);
		});

		await it("when called getting second page", async () => {
			const next3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: "00000001-0000-0007-0000-000000000007" },
					orderBy: undefined,
				},
				extraField: "id",
			});

			deepEqual(next3, [
				{
					id: "00000001-0000-0006-0000-000000000006",
					cursor: "00000001-0000-0006-0000-000000000006",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					id: "00000001-0000-0005-0000-000000000005",
					cursor: "00000001-0000-0005-0000-000000000005",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					id: "00000001-0000-0004-0000-000000000004",
					cursor: "00000001-0000-0004-0000-000000000004",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);

			deepEqual(toSorted(next3), next3);
		});

		await it("when called getting back to first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: undefined,
				},
				extraField: "id",
			});

			const prev3 = await query({
				sql,
				options: {
					tableName,
					pagination: { before: "00000001-0000-0006-0000-000000000006" },
					orderBy: undefined,
				},
				extraField: "id",
			});

			deepEqual(prev3, first3.toReversed());
			deepEqual(toSorted(prev3), first3);
		});

		// this test ensures the sorting is not inferring with the pagination
		// (ie. that by returning the first page because of the ordering hides
		// the fact that the previous page should be actually be done thanks to
		// before/after)
		await it("when called getting back to middle page", async () => {
			const prev3 = await query({
				sql,
				options: {
					tableName,
					pagination: { before: "00000001-0000-0005-0000-000000000005" },
					orderBy: undefined,
				},
				extraField: "id",
			});

			deepEqual(prev3, [
				{
					id: "00000001-0000-0006-0000-000000000006",
					cursor: "00000001-0000-0006-0000-000000000006",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					id: "00000001-0000-0007-0000-000000000007",
					cursor: "00000001-0000-0007-0000-000000000007",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					id: "00000001-0000-0008-0000-000000000008",
					cursor: "00000001-0000-0008-0000-000000000008",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);
			deepEqual(toSorted(prev3), [
				{
					id: "00000001-0000-0008-0000-000000000008",
					cursor: "00000001-0000-0008-0000-000000000008",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					id: "00000001-0000-0007-0000-000000000007",
					cursor: "00000001-0000-0007-0000-000000000007",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					id: "00000001-0000-0006-0000-000000000006",
					cursor: "00000001-0000-0006-0000-000000000006",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);
		});

		await it("when called getting the last page", async () => {
			const last3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: "00000001-0000-0004-0000-000000000004" },
					orderBy: undefined,
				},
				extraField: "id",
			});

			deepEqual(last3, [
				{
					id: "00000001-0000-0003-0000-000000000003",
					cursor: "00000001-0000-0003-0000-000000000003",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					id: "00000001-0000-0002-0000-000000000002",
					cursor: "00000001-0000-0002-0000-000000000002",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					id: "00000001-0000-0001-0000-000000000001",
					cursor: "00000001-0000-0001-0000-000000000001",
					hasNextPage: 0,
					hasPreviousPage: 1,
				},
			]);
			deepEqual(toSorted(last3), last3);
		});
	});

	await describe("given arbitrary order, asc", async () => {
		let sql: DatabaseSync;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data_postgres_arbitrary_ordering_asc";
			await paginationTestData<string, string>({
				sql(strings, ...parts) {
					const fullQuery = strings.reduce((acc, str, i) => {
						if (parts.length > i) {
							return acc + str + (parts[i] ?? "null");
						}

						return acc + str;
					}, "");

					return Promise.resolve(sql.prepare(fullQuery).all());
				},
				tableName,
			});
		});

		after(async () => {
			await sql.close();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			deepEqual(first3, [
				{
					name: "AAAA",
					cursor: "AAAA,00000001-0000-0001-0000-000000000001",
					hasNextPage: 1,
					hasPreviousPage: 0,
				},
				{
					name: "BBBB",
					cursor: "BBBB,00000001-0000-0002-0000-000000000002",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "CCCC",
					cursor: "CCCC,00000001-0000-0003-0000-000000000003",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);
			deepEqual(toSorted(first3, { column: "name", order: "asc" }), first3);
		});

		await it("when called getting second page", async () => {
			const next3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: "CCCC,00000001-0000-0003-0000-000000000003" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			deepEqual(next3, [
				{
					name: "DDDD",
					cursor: "DDDD,00000001-0000-0004-0000-000000000004",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "EEEE",
					cursor: "EEEE,00000001-0000-0005-0000-000000000005",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "FFFF",
					cursor: "FFFF,00000001-0000-0006-0000-000000000006",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);
			deepEqual(toSorted(next3, { column: "name", order: "asc" }), next3);
		});

		await it("when called getting back to first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			const prev3 = await query({
				sql,
				options: {
					tableName,
					pagination: { before: "DDDD,00000001-0000-0004-0000-000000000004" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			deepEqual(prev3, first3.toReversed());
			deepEqual(toSorted(prev3, { column: "name", order: "asc" }), first3);
		});

		// this test ensures the sorting is not inferring with the pagination
		// (ie. that by returning the first page because of the ordering hides
		// the fact that the previous page should be actually be done thanks to
		// before/after)
		await it("when called getting back to middle page", async () => {
			const prev3 = await query({
				sql,
				options: {
					tableName,
					pagination: { before: "EEEE,00000001-0000-0005-0000-000000000005" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			deepEqual(
				prev3,
				[
					{
						name: "BBBB",
						cursor: "BBBB,00000001-0000-0002-0000-000000000002",
						hasNextPage: 1,
						hasPreviousPage: 1,
					},
					{
						name: "CCCC",
						cursor: "CCCC,00000001-0000-0003-0000-000000000003",
						hasNextPage: 1,
						hasPreviousPage: 1,
					},
					{
						name: "DDDD",
						cursor: "DDDD,00000001-0000-0004-0000-000000000004",
						hasNextPage: 1,
						hasPreviousPage: 1,
					},
				].toReversed(),
			);
			deepEqual(toSorted(prev3, { column: "name", order: "asc" }), [
				{
					name: "BBBB",
					cursor: "BBBB,00000001-0000-0002-0000-000000000002",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "CCCC",
					cursor: "CCCC,00000001-0000-0003-0000-000000000003",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "DDDD",
					cursor: "DDDD,00000001-0000-0004-0000-000000000004",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);
		});

		await it("when called getting the last page", async () => {
			const last3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: "FFFF,00000001-0000-0006-0000-000000000006" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			deepEqual(last3, [
				{
					name: "GGGG",
					cursor: "GGGG,00000001-0000-0007-0000-000000000007",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "HHHH",
					cursor: "HHHH,00000001-0000-0008-0000-000000000008",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "IIII",
					cursor: "IIII,00000001-0000-0009-0000-000000000009",
					hasNextPage: 0,
					hasPreviousPage: 1,
				},
			]);
			deepEqual(toSorted(last3, { column: "name", order: "asc" }), last3);
		});
	});

	await describe("given arbitrary order, desc", async () => {
		let sql: DatabaseSync;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data_postgres_arbitrary_ordering_desc";
			await paginationTestData<string, string>({
				sql(strings, ...parts) {
					const fullQuery = strings.reduce((acc, str, i) => {
						if (parts.length > i) {
							return acc + str + (parts[i] ?? "null");
						}

						return acc + str;
					}, "");

					return Promise.resolve(sql.prepare(fullQuery).all());
				},
				tableName,
			});
		});

		after(async () => {
			await sql.close();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			deepEqual(first3, [
				{
					name: "IIII",
					cursor: "IIII,00000001-0000-0009-0000-000000000009",
					hasNextPage: 1,
					hasPreviousPage: 0,
				},
				{
					name: "HHHH",
					cursor: "HHHH,00000001-0000-0008-0000-000000000008",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "GGGG",
					cursor: "GGGG,00000001-0000-0007-0000-000000000007",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);
			deepEqual(toSorted(first3, { column: "name", order: "desc" }), first3);
		});

		await it("when called getting second page", async () => {
			const next3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: "GGGG,00000001-0000-0007-0000-000000000007" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			deepEqual(next3, [
				{
					name: "FFFF",
					cursor: "FFFF,00000001-0000-0006-0000-000000000006",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "EEEE",
					cursor: "EEEE,00000001-0000-0005-0000-000000000005",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "DDDD",
					cursor: "DDDD,00000001-0000-0004-0000-000000000004",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);
			deepEqual(toSorted(next3, { column: "name", order: "desc" }), next3);
		});

		await it("when called getting back to first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			const prev3 = await query({
				sql,
				options: {
					tableName,
					pagination: { before: "FFFF,00000001-0000-0006-0000-000000000006" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			deepEqual(prev3, first3.toReversed());
			deepEqual(toSorted(prev3, { column: "name", order: "desc" }), first3);
		});

		// this test ensures the sorting is not inferring with the pagination
		// (ie. that by returning the first page because of the ordering hides
		// the fact that the previous page should be actually be done thanks to
		// before/after)
		await it("when called getting back to middle page", async () => {
			const prev3 = await query({
				sql,
				options: {
					tableName,
					pagination: { before: "EEEE,00000001-0000-0005-0000-000000000005" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			deepEqual(
				prev3,
				[
					{
						name: "HHHH",
						cursor: "HHHH,00000001-0000-0008-0000-000000000008",
						hasNextPage: 1,
						hasPreviousPage: 1,
					},
					{
						name: "GGGG",
						cursor: "GGGG,00000001-0000-0007-0000-000000000007",
						hasNextPage: 1,
						hasPreviousPage: 1,
					},
					{
						name: "FFFF",
						cursor: "FFFF,00000001-0000-0006-0000-000000000006",
						hasNextPage: 1,
						hasPreviousPage: 1,
					},
				].toReversed(),
			);
			deepEqual(toSorted(prev3, { column: "name", order: "desc" }), [
				{
					name: "HHHH",
					cursor: "HHHH,00000001-0000-0008-0000-000000000008",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "GGGG",
					cursor: "GGGG,00000001-0000-0007-0000-000000000007",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "FFFF",
					cursor: "FFFF,00000001-0000-0006-0000-000000000006",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);
		});

		await it("when called getting the last page", async () => {
			const last3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: "DDDD,00000001-0000-0004-0000-000000000004" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			deepEqual(last3, [
				{
					name: "CCCC",
					cursor: "CCCC,00000001-0000-0003-0000-000000000003",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "BBBB",
					cursor: "BBBB,00000001-0000-0002-0000-000000000002",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					name: "AAAA",
					cursor: "AAAA,00000001-0000-0001-0000-000000000001",
					hasNextPage: 0,
					hasPreviousPage: 1,
				},
			]);
			deepEqual(toSorted(last3, { column: "name", order: "desc" }), last3);
		});
	});

	await describe("given order by numeric field (amount), asc", async () => {
		let sql: DatabaseSync;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data_sqlite_amount_ordering_asc";
			await paginationTestDataWithAmount<string, string>({
				sql(strings, ...parts) {
					const fullQuery = strings.reduce((acc, str, i) => {
						if (parts.length > i) {
							return acc + str + (parts[i] ?? "null");
						}

						return acc + str;
					}, "");

					return Promise.resolve(sql.prepare(fullQuery).all());
				},
				tableName,
			});
		});

		after(async () => {
			await sql.close();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "amount", order: "asc" },
				},
				extraField: "amount",
			});

			deepEqual(first3, [
				{
					amount: 50,
					cursor: "50,00000001-0000-0003-0000-000000000003",
					hasNextPage: 1,
					hasPreviousPage: 0,
				},
				{
					amount: 75,
					cursor: "75,00000001-0000-0007-0000-000000000007",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					amount: 100,
					cursor: "100,00000001-0000-0001-0000-000000000001",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);
			deepEqual(toSorted(first3, { column: "amount", order: "asc" }), first3);
		});

		await it("when called getting second page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "amount", order: "asc" },
				},
				extraField: "amount",
			});

			const first3Sorted = toSorted(first3, {
				column: "amount",
				order: "asc",
			});

			const lastCursor = first3Sorted.at(2)?.cursor ?? "";

			const next3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: lastCursor },
					orderBy: { column: "amount", order: "asc" },
				},
				extraField: "amount",
			});

			// Verify we got results
			deepEqual(next3.length, 3);
			// Most importantly: verify results are correctly sorted numerically (not lexicographically)
			// This is what the PR fixes - numeric comparison in sorting
			deepEqual(toSorted(next3, { column: "amount", order: "asc" }), next3);

			// Verify that amounts are sorted correctly (50 < 75 < 100, not "100" < "50" < "75")
			const amounts = next3.map((item) =>
				Number(item.cursor.split(",")[0] ?? "0"),
			);
			for (let i = 1; i < amounts.length; i++) {
				const current = amounts[i];
				const previous = amounts[i - 1];
				if (current !== undefined && previous !== undefined) {
					deepEqual(
						current >= previous,
						true,
						`Amounts should be in ascending numeric order: ${amounts.join(", ")}`,
					);
				}
			}
		});
	});

	await describe("given order by date field (created_at), asc", async () => {
		let sql: DatabaseSync;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data_sqlite_date_ordering_asc";
			await paginationTestDataWithDate<string, string>({
				sql(strings, ...parts) {
					const fullQuery = strings.reduce((acc, str, i) => {
						if (parts.length > i) {
							return acc + str + (parts[i] ?? "null");
						}

						return acc + str;
					}, "");

					return Promise.resolve(sql.prepare(fullQuery).all());
				},
				tableName,
			});
		});

		after(async () => {
			await sql.close();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "created_at", order: "asc" },
				},
				extraField: "created_at",
			});

			// The cursor should contain the timestamp value, sorted by date then id
			deepEqual(first3.length, 3);
			deepEqual(
				first3[0]?.cursor.split(",")[1],
				"00000001-0000-0001-0000-000000000001",
			);
			deepEqual(
				first3[1]?.cursor.split(",")[1],
				"00000001-0000-0002-0000-000000000002",
			);
			deepEqual(
				first3[2]?.cursor.split(",")[1],
				"00000001-0000-0003-0000-000000000003",
			);
			deepEqual(
				toSorted(first3, { column: "created_at", order: "asc" }),
				first3,
			);
		});

		await it("when called getting second page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "created_at", order: "asc" },
				},
				extraField: "created_at",
			});

			const first3Sorted = toSorted(first3, {
				column: "created_at",
				order: "asc",
			});

			const next3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: first3Sorted.at(2)?.cursor ?? "" },
					orderBy: { column: "created_at", order: "asc" },
				},
				extraField: "created_at",
			});

			deepEqual(next3.length, 3);
			deepEqual(
				next3[0]?.cursor.split(",")[1],
				"00000001-0000-0004-0000-000000000004",
			);
			deepEqual(
				next3[1]?.cursor.split(",")[1],
				"00000001-0000-0005-0000-000000000005",
			);
			deepEqual(
				next3[2]?.cursor.split(",")[1],
				"00000001-0000-0006-0000-000000000006",
			);
			deepEqual(toSorted(next3, { column: "created_at", order: "asc" }), next3);
		});
	});

	await describe("given order by numeric field (amount), desc", async () => {
		let sql: DatabaseSync;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data_sqlite_amount_ordering_desc";
			await paginationTestDataWithAmount<string, string>({
				sql(strings, ...parts) {
					const fullQuery = strings.reduce((acc, str, i) => {
						if (parts.length > i) {
							return acc + str + (parts[i] ?? "null");
						}

						return acc + str;
					}, "");

					return Promise.resolve(sql.prepare(fullQuery).all());
				},
				tableName,
			});
		});

		after(async () => {
			await sql.close();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "amount", order: "desc" },
				},
				extraField: "amount",
			});

			deepEqual(first3, [
				{
					amount: 400,
					cursor: "400,00000001-0000-0008-0000-000000000008",
					hasNextPage: 1,
					hasPreviousPage: 0,
				},
				{
					amount: 300,
					cursor: "300,00000001-0000-0004-0000-000000000004",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
				{
					amount: 250,
					cursor: "250,00000001-0000-0006-0000-000000000006",
					hasNextPage: 1,
					hasPreviousPage: 1,
				},
			]);
			deepEqual(toSorted(first3, { column: "amount", order: "desc" }), first3);
		});

		await it("when called getting second page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "amount", order: "desc" },
				},
				extraField: "amount",
			});

			const first3Sorted = toSorted(first3, {
				column: "amount",
				order: "desc",
			});

			const lastCursor = first3Sorted.at(-1)?.cursor ?? "";

			const next3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: lastCursor },
					orderBy: { column: "amount", order: "desc" },
				},
				extraField: "amount",
			});

			// Most importantly: verify results are correctly sorted numerically (not lexicographically)
			// This is what the PR fixes - numeric comparison in sorting
			deepEqual(toSorted(next3, { column: "amount", order: "desc" }), next3);

			// Verify that amounts are sorted correctly (400 > 300 > 250, not "250" > "300" > "400")
			const amounts = next3.map((item) =>
				Number(item.cursor.split(",")[0] ?? "0"),
			);
			for (let i = 1; i < amounts.length; i++) {
				const current = amounts[i];
				const previous = amounts[i - 1];
				if (current !== undefined && previous !== undefined) {
					deepEqual(
						current <= previous,
						true,
						`Amounts should be in descending numeric order: ${amounts.join(", ")}`,
					);
				}
			}
		});
	});

	await describe("given order by date field (created_at), desc", async () => {
		let sql: DatabaseSync;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data_sqlite_date_ordering_desc";
			await paginationTestDataWithDate<string, string>({
				sql(strings, ...parts) {
					const fullQuery = strings.reduce((acc, str, i) => {
						if (parts.length > i) {
							return acc + str + (parts[i] ?? "null");
						}

						return acc + str;
					}, "");

					return Promise.resolve(sql.prepare(fullQuery).all());
				},
				tableName,
			});
		});

		after(async () => {
			await sql.close();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "created_at", order: "desc" },
				},
				extraField: "created_at",
			});

			// The cursor should contain the timestamp value, sorted by date then id
			deepEqual(first3.length, 3);
			deepEqual(
				first3[0]?.cursor.split(",")[1],
				"00000001-0000-0009-0000-000000000009",
			);
			deepEqual(
				first3[1]?.cursor.split(",")[1],
				"00000001-0000-0008-0000-000000000008",
			);
			deepEqual(
				first3[2]?.cursor.split(",")[1],
				"00000001-0000-0007-0000-000000000007",
			);
			deepEqual(
				toSorted(first3, { column: "created_at", order: "desc" }),
				first3,
			);
		});

		await it("when called getting second page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "created_at", order: "desc" },
				},
				extraField: "created_at",
			});

			const first3Sorted = toSorted(first3, {
				column: "created_at",
				order: "desc",
			});

			const next3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: first3Sorted.at(-1)?.cursor ?? "" },
					orderBy: { column: "created_at", order: "desc" },
				},
				extraField: "created_at",
			});

			deepEqual(next3.length, 3);
			deepEqual(
				next3[0]?.cursor.split(",")[1],
				"00000001-0000-0006-0000-000000000006",
			);
			deepEqual(
				next3[1]?.cursor.split(",")[1],
				"00000001-0000-0005-0000-000000000005",
			);
			deepEqual(
				next3[2]?.cursor.split(",")[1],
				"00000001-0000-0004-0000-000000000004",
			);
			deepEqual(
				toSorted(next3, { column: "created_at", order: "desc" }),
				next3,
			);
		});
	});
});
