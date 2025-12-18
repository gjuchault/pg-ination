import { deepEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import postgres from "postgres";

import { type PaginateOptions, paginate } from "../../paginate.ts";
import { toSorted } from "../../sort.ts";
import { postgresAdapter } from "../postgres.ts";
import {
	paginationTestData,
	paginationTestDataWithAmount,
	paginationTestDataWithDate,
} from "./helpers.ts";

// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
const dbUrl = process.env["DB_URL"];

if (dbUrl === undefined) {
	throw new Error("DB_URL is not set");
}

function getClient(): postgres.Sql {
	const pool = postgres(dbUrl ?? "", {
		idle_timeout: 1000,
	});

	return pool;
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
	sql: postgres.Sql;
	options: PaginateOptions;
	extraField?: ExtraField;
}): Promise<QueryResult<ExtraField>[]> {
	const result = paginate(options);
	const adapterResult = postgresAdapter(options, result);

	const data = await sql`
		select
			${extraField !== undefined ? sql`${sql(extraField as string)},` : sql``}
			${adapterResult.cursor} as "cursor",
			${adapterResult.hasNextPage} as "hasNextPage",
			${adapterResult.hasPreviousPage} as "hasPreviousPage"
		from ${sql(options.tableName)}
		where ${adapterResult.filter}
		order by ${adapterResult.order}
		limit 3
	`;

	return Array.from(data) as QueryResult<ExtraField>[];
}

await describe("postgresAdapter", async () => {
	await describe("given no ordering", async () => {
		let sql: postgres.Sql;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data-postgres-no-ordering";
			await paginationTestData<postgres.Fragment, postgres.Helper<string, []>>({
				sql: sql,
				tableName: sql(tableName),
			});
		});

		after(async () => {
			await sql.end();
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
			deepEqual(toSorted(prev3), [
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
			deepEqual(toSorted(last3), last3);
		});
	});

	await describe("given arbitrary order, asc", async () => {
		let sql: postgres.Sql;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data-postgres-arbitrary-ordering-asc";
			await paginationTestData<postgres.Fragment, postgres.Helper<string, []>>({
				sql,
				tableName: sql(tableName),
			});
		});

		after(async () => {
			await sql.end();
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
			deepEqual(toSorted(prev3, { column: "name", order: "asc" }), [
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
			deepEqual(toSorted(last3, { column: "name", order: "asc" }), last3);
		});
	});

	await describe("given arbitrary order, desc", async () => {
		let sql: postgres.Sql;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data-postgres-arbitrary-ordering-desc";
			await paginationTestData<postgres.Fragment, postgres.Helper<string, []>>({
				sql,
				tableName: sql(tableName),
			});
		});

		after(async () => {
			await sql.end();
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
			deepEqual(toSorted(prev3, { column: "name", order: "desc" }), [
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
			deepEqual(toSorted(last3, { column: "name", order: "desc" }), last3);
		});
	});

	await describe("given order by numeric field (amount), asc", async () => {
		let sql: postgres.Sql;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data-postgres-amount-ordering-asc";
			await paginationTestDataWithAmount<
				postgres.Fragment,
				postgres.Helper<string, []>
			>({
				sql,
				tableName: sql(tableName),
			});
		});

		after(async () => {
			await sql.end();
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
					amount: "50",
					cursor: "50,00000001-0000-0003-0000-000000000003",
					hasNextPage: true,
					hasPreviousPage: false,
				},
				{
					amount: "75",
					cursor: "75,00000001-0000-0007-0000-000000000007",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					amount: "100",
					cursor: "100,00000001-0000-0001-0000-000000000001",
					hasNextPage: true,
					hasPreviousPage: true,
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
					orderBy: { column: "amount", order: "asc", type: "numeric" },
				},
				extraField: "amount",
			});

			const first3Sorted = toSorted(first3, {
				column: "amount",
				order: "asc",
			});

			const lastCursor = first3Sorted.at(-1)?.cursor ?? "";

			const next3 = await query({
				sql,
				options: {
					tableName,
					pagination: { after: lastCursor },
					orderBy: { column: "amount", order: "asc", type: "numeric" },
				},
				extraField: "amount",
			});

			deepEqual(next3, [
				{
					amount: "125",
					cursor: "125,00000001-0000-0009-0000-000000000009",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					amount: "150",
					cursor: "150,00000001-0000-0005-0000-000000000005",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					amount: "200",
					cursor: "200,00000001-0000-0002-0000-000000000002",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
		});
	});

	await describe("given order by date field (created_at), asc", async () => {
		let sql: postgres.Sql;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data-postgres-date-ordering-asc";
			await paginationTestDataWithDate<
				postgres.Fragment,
				postgres.Helper<string, []>
			>({
				sql,
				tableName: sql(tableName),
			});
		});

		after(async () => {
			await sql.end();
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

			deepEqual(first3, [
				{
					created_at: new Date("2025-05-09T10:11:00.000Z"),
					cursor: "2025-05-09 10:11:00+00,00000001-0000-0001-0000-000000000001",
					hasNextPage: true,
					hasPreviousPage: false,
				},
				{
					created_at: new Date("2025-05-09T10:11:01.000Z"),
					cursor: "2025-05-09 10:11:01+00,00000001-0000-0002-0000-000000000002",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					created_at: new Date("2025-05-09T10:11:02.000Z"),
					cursor: "2025-05-09 10:11:02+00,00000001-0000-0003-0000-000000000003",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
		});

		await it("when called getting second page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "created_at", order: "asc", type: "timestamp" },
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
					orderBy: { column: "created_at", order: "asc", type: "timestamp" },
				},
				extraField: "created_at",
			});

			deepEqual(next3, [
				{
					created_at: new Date("2025-05-09T10:11:03.000Z"),
					cursor: "2025-05-09 10:11:03+00,00000001-0000-0004-0000-000000000004",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					created_at: new Date("2025-05-09T10:11:04.000Z"),
					cursor: "2025-05-09 10:11:04+00,00000001-0000-0005-0000-000000000005",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					created_at: new Date("2025-05-09T10:11:05.000Z"),
					cursor: "2025-05-09 10:11:05+00,00000001-0000-0006-0000-000000000006",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
		});
	});

	await describe("given order by numeric field (amount), desc", async () => {
		let sql: postgres.Sql;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data-postgres-amount-ordering-desc";
			await paginationTestDataWithAmount<
				postgres.Fragment,
				postgres.Helper<string, []>
			>({
				sql,
				tableName: sql(tableName),
			});
		});

		after(async () => {
			await sql.end();
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
					amount: "400",
					cursor: "400,00000001-0000-0008-0000-000000000008",
					hasNextPage: true,
					hasPreviousPage: false,
				},
				{
					amount: "300",
					cursor: "300,00000001-0000-0004-0000-000000000004",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					amount: "250",
					cursor: "250,00000001-0000-0006-0000-000000000006",
					hasNextPage: true,
					hasPreviousPage: true,
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
					orderBy: { column: "amount", order: "desc", type: "numeric" },
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
					orderBy: { column: "amount", order: "desc", type: "numeric" },
				},
				extraField: "amount",
			});

			deepEqual(next3, [
				{
					amount: "200",
					cursor: "200,00000001-0000-0002-0000-000000000002",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					amount: "150",
					cursor: "150,00000001-0000-0005-0000-000000000005",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					amount: "125",
					cursor: "125,00000001-0000-0009-0000-000000000009",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
		});
	});

	await describe("given order by date field (created_at), desc", async () => {
		let sql: postgres.Sql;
		let tableName: string;

		before(async () => {
			sql = getClient();
			tableName = "data-postgres-date-ordering-desc";
			await paginationTestDataWithDate<
				postgres.Fragment,
				postgres.Helper<string, []>
			>({
				sql,
				tableName: sql(tableName),
			});
		});

		after(async () => {
			await sql.end();
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

			deepEqual(first3, [
				{
					created_at: new Date("2025-05-09T10:11:08.000Z"),
					cursor: "2025-05-09 10:11:08+00,00000001-0000-0009-0000-000000000009",
					hasNextPage: true,
					hasPreviousPage: false,
				},
				{
					created_at: new Date("2025-05-09T10:11:07.000Z"),
					cursor: "2025-05-09 10:11:07+00,00000001-0000-0008-0000-000000000008",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					created_at: new Date("2025-05-09T10:11:06.000Z"),
					cursor: "2025-05-09 10:11:06+00,00000001-0000-0007-0000-000000000007",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
		});

		await it("when called getting second page", async () => {
			const first3 = await query({
				sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "created_at", order: "desc", type: "timestamp" },
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
					orderBy: { column: "created_at", order: "desc", type: "timestamp" },
				},
				extraField: "created_at",
			});

			deepEqual(next3, [
				{
					created_at: new Date("2025-05-09T10:11:05.000Z"),
					cursor: "2025-05-09 10:11:05+00,00000001-0000-0006-0000-000000000006",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					created_at: new Date("2025-05-09T10:11:04.000Z"),
					cursor: "2025-05-09 10:11:04+00,00000001-0000-0005-0000-000000000005",
					hasNextPage: true,
					hasPreviousPage: true,
				},
				{
					created_at: new Date("2025-05-09T10:11:03.000Z"),
					cursor: "2025-05-09 10:11:03+00,00000001-0000-0004-0000-000000000004",
					hasNextPage: true,
					hasPreviousPage: true,
				},
			]);
		});
	});
});
