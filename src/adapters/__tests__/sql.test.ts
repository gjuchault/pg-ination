import { deepEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Client } from "pg";

import { toSorted } from "../../sort.ts";
import { pgAdapter } from "../pg.ts";
import { paginationTestData } from "./helpers.ts";
import { paginate, type PaginateOptions } from "../../paginate.ts";

// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
const dbUrl = process.env["DB_URL"];

if (dbUrl === undefined) {
	throw new Error("DB_URL is not set");
}

async function getClient(): Promise<Client> {
	const sql = new Client({
		connectionString: dbUrl,
		// biome-ignore lint/style/useNamingConvention: pg
		statement_timeout: 1_000,
		// biome-ignore lint/style/useNamingConvention: pg
		query_timeout: 1_000,
		// biome-ignore lint/style/useNamingConvention: pg
		lock_timeout: 1_000,
		connectionTimeoutMillis: 1_000,
		// biome-ignore lint/style/useNamingConvention: pg
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

async function query({
	client,
	options,
	extraField,
}: {
	client: Client;
	options: PaginateOptions;
	extraField?: string;
}): Promise<readonly unknown[]> {
	const result = paginate(options);
	const adapterResult = pgAdapter(options, result);

	const data = await client.query(rawSql`
		select
			${adapterResult.cursor} as "cursor",
			${adapterResult.hasNextPage} as "hasNextPage",
			${adapterResult.hasPreviousPage} as "hasPreviousPage",
			${extraField !== undefined ? client.escapeIdentifier(extraField) : ""}
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
			deepEqual(toSorted(first3, { column: "name", order: "asc" }), first3);
		});

		await it("when called getting second page", async () => {
			const next3 = await query({
				client: sql,
				options: {
					tableName,
					pagination: { after: "00000001-0000-0003-0000-000000000003,CCCC" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			deepEqual(next3, [
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
					pagination: { before: "00000001-0000-0004-0000-000000000004,DDDD" },
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
					pagination: { before: "00000001-0000-0005-0000-000000000005,EEEE" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			deepEqual(
				prev3,
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
			deepEqual(toSorted(prev3, { column: "name", order: "asc" }), [
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

		await it("when called getting the last page", async () => {
			const last3 = await query({
				client: sql,
				options: {
					tableName,
					pagination: { after: "00000001-0000-0006-0000-000000000006,FFFF" },
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			deepEqual(last3, [
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
			deepEqual(toSorted(first3, { column: "name", order: "desc" }), first3);
		});

		await it("when called getting second page", async () => {
			const next3 = await query({
				client: sql,
				options: {
					tableName,
					pagination: { after: "00000001-0000-0007-0000-000000000007,GGGG" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			deepEqual(next3, [
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
					pagination: { before: "00000001-0000-0006-0000-000000000006,FFFF" },
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
					pagination: { before: "00000001-0000-0005-0000-000000000005,EEEE" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			deepEqual(
				prev3,
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
			deepEqual(toSorted(prev3, { column: "name", order: "desc" }), [
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

		await it("when called getting the last page", async () => {
			const last3 = await query({
				client: sql,
				options: {
					tableName,
					pagination: { after: "00000001-0000-0004-0000-000000000004,DDDD" },
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			deepEqual(last3, [
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
			deepEqual(toSorted(last3, { column: "name", order: "desc" }), last3);
		});
	});
});
