import { deepEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Client } from "pg";

import { type PaginateOptions, paginate } from "../../paginate.ts";
import { toSorted } from "../../sort.ts";
import { pgAdapter } from "../pg.ts";
import { paginationTestData, paginationTestNullData } from "./helpers.ts";

// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
const dbUrl = process.env["DB_URL"];

if (dbUrl === undefined) {
	throw new Error("DB_URL is not set");
}

async function getClient(): Promise<Client> {
	const sql = new Client({
		connectionString: dbUrl,
		statement_timeout: 1_000,
		query_timeout: 1_000,
		lock_timeout: 1_000,
		connectionTimeoutMillis: 1_000,
		idle_in_transaction_session_timeout: 1_000,
	});

	await sql.connect();

	return sql;
}

function rawSql(strings: TemplateStringsArray, ...args: string[]): string {
	let output = "";

	for (let i = 0; i < strings.length; i += 1) {
		output += strings[i] + (args[i] ?? "");
	}

	return output;
}

type QueryResult<ExtraField extends string | undefined> = {
	cursor: string;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
} & { [Key in Exclude<ExtraField, undefined>]: string | null };

async function query<ExtraField extends string | undefined>({
	client,
	options,
	extraField,
}: {
	client: Client;
	options: PaginateOptions;
	extraField?: ExtraField;
}): Promise<QueryResult<ExtraField>[]> {
	const result = paginate(options);
	const adapterResult = pgAdapter(options, result);

	const data = await client.query(rawSql`
		select
			${extraField !== undefined ? `${client.escapeIdentifier(extraField)},` : ""}
			${adapterResult.cursor} as "cursor",
			${adapterResult.hasNextPage} as "hasNextPage",
			${adapterResult.hasPreviousPage} as "hasPreviousPage"
		from ${client.escapeIdentifier(options.tableName)}
		where ${adapterResult.filter}
		order by ${adapterResult.order}
		limit 3
	`);

	return data.rows;
}

await describe("sqlAdapter", async () => {
	await describe("given no ordering", async () => {
		let sql: Client;
		let tableName: string;

		before(async () => {
			sql = await getClient();
			tableName = "data-sql-no-ordering";
			await paginationTestData<string, string>({
				sql: async (query, ...args) => {
					const { rows } = await sql.query(rawSql(query, ...args));

					return rows;
				},
				tableName: sql.escapeIdentifier(tableName),
			});
		});

		after(async () => {
			await sql.end();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				client: sql,
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
				client: sql,
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
				client: sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: undefined,
				},
				extraField: "id",
			});

			const prev3 = await query({
				client: sql,
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
				client: sql,
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
				client: sql,
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
		let sql: Client;
		let tableName: string;

		before(async () => {
			sql = await getClient();
			tableName = "data-sql-arbitrary-ordering-asc";
			await paginationTestData<string, string>({
				sql: async (query, ...args) => {
					const { rows } = await sql.query(rawSql(query, ...args));

					return rows;
				},
				tableName: sql.escapeIdentifier(tableName),
			});
		});

		after(async () => {
			await sql.end();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				client: sql,
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
				client: sql,
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
				client: sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			const prev3 = await query({
				client: sql,
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
				client: sql,
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
				client: sql,
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
		let sql: Client;
		let tableName: string;

		before(async () => {
			sql = await getClient();
			tableName = "data-sql-arbitrary-ordering-desc";
			await paginationTestData<string, string>({
				sql: async (query, ...args) => {
					const { rows } = await sql.query(rawSql(query, ...args));

					return rows;
				},
				tableName: sql.escapeIdentifier(tableName),
			});
		});

		after(async () => {
			await sql.end();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				client: sql,
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
				client: sql,
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
				client: sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			const prev3 = await query({
				client: sql,
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
				client: sql,
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
				client: sql,
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

	await describe("given arbitrary order with null values", async () => {
		let sql: Client;
		let tableName: string;

		before(async () => {
			sql = await getClient();
			tableName = "data-sql-null-values";
			await paginationTestNullData<string, string>({
				sql: async (query, ...args) => {
					const { rows } = await sql.query(rawSql(query, ...args));

					return rows;
				},
				tableName: sql.escapeIdentifier(tableName),
			});
		});

		after(async () => {
			await sql.end();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				client: sql,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			deepEqual(first3, [
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

			deepEqual(toSorted(first3, { column: "name", order: "asc" }), first3);
		});

		await it("when called getting second page", async () => {
			const next3 = await query({
				client: sql,
				options: {
					tableName,
					pagination: { after: "00000001-0000-0003-0000-000000000003" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			deepEqual(toSorted(next3, { column: "name", order: "asc" }), [
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

			deepEqual(toSorted(next3, { column: "name", order: "asc" }), next3);
		});

		await it("when called getting back to first page", async () => {
			const first3 = await query({
				client: sql,
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
			});

			const next3 = await query({
				client: sql,
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
			});

			const prev3 = await query({
				client: sql,
				options: {
					tableName,
					pagination: { before: next3Sorted[0]?.cursor ?? "" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "id",
			});
			const prev3Sorted = toSorted(prev3, { column: "name", order: "asc" });

			// In this specific case, we need to sort all the time since we can't sort ascending by name (since name is null)
			// the fallback is to sort by id in either direction, as long as we're consistent
			deepEqual(prev3Sorted, first3Sorted);
		});

		// this test ensures the sorting is not inferring with the pagination
		// (ie. that by returning the first page because of the ordering hides
		// the fact that the previous page should be actually be done thanks to
		// before/after)
		await it("when called getting back to middle page", async () => {
			const prev3 = await query({
				client: sql,
				options: {
					tableName,
					pagination: { before: "00000001-0000-0005-0000-000000000005" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "id",
			});

			deepEqual(toSorted(prev3, { column: "name", order: "asc" }), [
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

		await it("when called getting the last page", async () => {
			const last3 = await query({
				client: sql,
				options: {
					tableName,
					pagination: { after: "00000001-0000-0004-0000-000000000004" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "id",
			});

			deepEqual(toSorted(last3, { column: "name", order: "asc" }), [
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
