import { deepEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
	type DatabasePool,
	type IdentifierSqlToken,
	type ValueExpression,
	createPool,
	sql,
} from "slonik";

import { type PaginateOptions, paginate } from "../../paginate.ts";
import { toSorted } from "../../sort.ts";
import { slonikAdapter } from "../slonik.ts";
import { paginationTestData } from "./helpers.ts";

// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature
const dbUrl = process.env["DB_URL"];

if (dbUrl === undefined) {
	throw new Error("DB_URL is not set");
}

async function getClient(): Promise<DatabasePool> {
	const pool = await createPool(dbUrl ?? "", {
		idleTimeout: 1000,
		statementTimeout: 1000,
		connectionTimeout: 1000,
		gracefulTerminationTimeout: 1000,
		idleInTransactionSessionTimeout: 1000,
	});

	return pool;
}

async function query({
	client,
	options,
	extraField,
}: {
	client: DatabasePool;
	options: PaginateOptions;
	extraField?: string;
}): Promise<readonly unknown[]> {
	const result = paginate(options);
	const adapterResult = slonikAdapter(options, result);

	const data = await client.any(sql.unsafe`
		select
			${adapterResult.cursor} as "cursor",
			${adapterResult.hasNextPage} as "hasNextPage",
			${adapterResult.hasPreviousPage} as "hasPreviousPage",
			${extraField !== undefined ? sql.identifier([extraField]) : sql.unsafe``}
		from ${sql.identifier([options.tableName])}
		where ${adapterResult.filter}
		order by ${adapterResult.order}
		limit 3
	`);

	return data;
}

await describe("slonikAdapter", async () => {
	await describe("given no ordering", async () => {
		let pool: DatabasePool;
		let tableName: string;

		before(async () => {
			pool = await getClient();
			tableName = "data-slonik-no-ordering";
			await paginationTestData<ValueExpression, IdentifierSqlToken>({
				sql: async (query, ...args) => {
					return await pool.connect(async (connection) => {
						return await connection.any(sql.unsafe(query, ...args));
					});
				},
				tableName: sql.identifier([tableName]),
			});
		});

		after(async () => {
			await pool.end();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				client: pool,
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
				client: pool,
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
				client: pool,
				options: {
					tableName,
					pagination: undefined,
					orderBy: undefined,
				},
				extraField: "id",
			});

			const prev3 = await query({
				client: pool,
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
				client: pool,
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
				client: pool,
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
		let pool: DatabasePool;
		let tableName: string;

		before(async () => {
			pool = await getClient();
			tableName = "data-slonik-arbitrary-ordering-asc";
			await paginationTestData<ValueExpression, IdentifierSqlToken>({
				sql: async (query, ...args) => {
					return await pool.connect(async (connection) => {
						return await connection.any(sql.unsafe(query, ...args));
					});
				},
				tableName: sql.identifier([tableName]),
			});
		});

		after(async () => {
			await pool.end();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				client: pool,
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
				client: pool,
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
				client: pool,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				extraField: "name",
			});

			const prev3 = await query({
				client: pool,
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
				client: pool,
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
				client: pool,
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
		let pool: DatabasePool;
		let tableName: string;

		before(async () => {
			pool = await getClient();
			tableName = "data-slonik-arbitrary-ordering-desc";
			await paginationTestData<ValueExpression, IdentifierSqlToken>({
				sql: async (query, ...args) => {
					return await pool.connect(async (connection) => {
						return await connection.any(sql.unsafe(query, ...args));
					});
				},
				tableName: sql.identifier([tableName]),
			});
		});

		after(async () => {
			await pool.end();
		});

		await it("when called getting first page", async () => {
			const first3 = await query({
				client: pool,
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
				client: pool,
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
				client: pool,
				options: {
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "desc" },
				},
				extraField: "name",
			});

			const prev3 = await query({
				client: pool,
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
				client: pool,
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
				client: pool,
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
});
