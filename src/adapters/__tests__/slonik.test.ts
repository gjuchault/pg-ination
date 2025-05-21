import { deepEqual } from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { type DatabasePool, createPool, sql } from "slonik";

import { toSorted } from "../../sort.ts";
import { slonikAdapter } from "../slonik.ts";
import { type TestDataQuery, paginationTestData } from "./helpers.ts";

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

await describe("slonikAdapter", async () => {
	await describe("given no ordering", async () => {
		let pool: DatabasePool;
		let tableName: string;
		let q: TestDataQuery<"id">;

		before(async () => {
			pool = await getClient();
			tableName = "data-slonik-no-ordering";
			q = await paginationTestData({
				escapeIdentifier: (input) => sql.identifier([input]),
				sql: async (query, ...args) => {
					return await pool.connect(async (connection) => {
						return await connection.any(sql.unsafe(query, ...args));
					});
				},
				adapter: slonikAdapter,
				tableName,
			});
		});

		after(async () => {
			await pool.end();
		});

		await it("when called getting first page", async () => {
			const first3 = await q(
				{
					tableName,
					pagination: undefined,
					orderBy: undefined,
				},
				"id",
			);

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
			const next3 = await q(
				{
					tableName,
					pagination: { after: "00000001-0000-0007-0000-000000000007" },
					orderBy: undefined,
				},
				"id",
			);

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
			const first3 = await q(
				{
					tableName,
					pagination: undefined,
					orderBy: undefined,
				},
				"id",
			);

			const prev3 = await q(
				{
					tableName,
					pagination: { before: "00000001-0000-0006-0000-000000000006" },
					orderBy: undefined,
				},
				"id",
			);

			deepEqual(prev3, first3.toReversed());
			deepEqual(toSorted(prev3), first3);
		});

		// this test ensures the sorting is not inferring with the pagination
		// (ie. that by returning the first page because of the ordering hides
		// the fact that the previous page should be actually be done thanks to
		// before/after)
		await it("when called getting back to middle page", async () => {
			const prev3 = await q(
				{
					tableName,
					pagination: { before: "00000001-0000-0005-0000-000000000005" },
					orderBy: undefined,
				},
				"id",
			);

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
			const last3 = await q(
				{
					tableName,
					pagination: { after: "00000001-0000-0004-0000-000000000004" },
					orderBy: undefined,
				},
				"id",
			);

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
		let q: TestDataQuery<"name">;

		before(async () => {
			pool = await getClient();
			tableName = "data-slonik-arbitrary-ordering-asc";
			q = await paginationTestData({
				escapeIdentifier: (input) => sql.identifier([input]),
				sql: async (query, ...args) => {
					return await pool.connect(async (connection) => {
						return await connection.any(sql.unsafe(query, ...args));
					});
				},
				adapter: slonikAdapter,
				tableName,
			});
		});

		after(async () => {
			await pool.end();
		});

		await it("when called getting first page", async () => {
			const first3 = await q(
				{
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				"name",
			);

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
			const next3 = await q(
				{
					tableName,
					pagination: { after: "00000001-0000-0003-0000-000000000003,CCCC" },
					orderBy: { column: "name", order: "asc" },
				},
				"name",
			);

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
			const first3 = await q(
				{
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "asc" },
				},
				"name",
			);

			const prev3 = await q(
				{
					tableName,
					pagination: { before: "00000001-0000-0004-0000-000000000004,DDDD" },
					orderBy: { column: "name", order: "asc" },
				},
				"name",
			);

			deepEqual(prev3, first3.toReversed());
			deepEqual(toSorted(prev3, { column: "name", order: "asc" }), first3);
		});

		// this test ensures the sorting is not inferring with the pagination
		// (ie. that by returning the first page because of the ordering hides
		// the fact that the previous page should be actually be done thanks to
		// before/after)
		await it("when called getting back to middle page", async () => {
			const prev3 = await q(
				{
					tableName,
					pagination: { before: "00000001-0000-0005-0000-000000000005,EEEE" },
					orderBy: { column: "name", order: "asc" },
				},
				"name",
			);

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
			const last3 = await q(
				{
					tableName,
					pagination: { after: "00000001-0000-0006-0000-000000000006,FFFF" },
					orderBy: { column: "name", order: "asc" },
				},
				"name",
			);

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
		let pool: DatabasePool;
		let tableName: string;
		let q: TestDataQuery<"name">;

		before(async () => {
			pool = await getClient();
			tableName = "data-slonik-arbitrary-ordering-desc";
			q = await paginationTestData({
				escapeIdentifier: (input) => sql.identifier([input]),
				sql: async (query, ...args) => {
					return await pool.connect(async (connection) => {
						return await connection.any(sql.unsafe(query, ...args));
					});
				},
				adapter: slonikAdapter,
				tableName,
			});
		});

		after(async () => {
			await pool.end();
		});

		await it("when called getting first page", async () => {
			const first3 = await q(
				{
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "desc" },
				},
				"name",
			);

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
			const next3 = await q(
				{
					tableName,
					pagination: { after: "00000001-0000-0007-0000-000000000007,GGGG" },
					orderBy: { column: "name", order: "desc" },
				},
				"name",
			);

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
			const first3 = await q(
				{
					tableName,
					pagination: undefined,
					orderBy: { column: "name", order: "desc" },
				},
				"name",
			);

			const prev3 = await q(
				{
					tableName,
					pagination: { before: "00000001-0000-0006-0000-000000000006,FFFF" },
					orderBy: { column: "name", order: "desc" },
				},
				"name",
			);

			deepEqual(prev3, first3.toReversed());
			deepEqual(toSorted(prev3, { column: "name", order: "desc" }), first3);
		});

		// this test ensures the sorting is not inferring with the pagination
		// (ie. that by returning the first page because of the ordering hides
		// the fact that the previous page should be actually be done thanks to
		// before/after)
		await it("when called getting back to middle page", async () => {
			const prev3 = await q(
				{
					tableName,
					pagination: { before: "00000001-0000-0005-0000-000000000005,EEEE" },
					orderBy: { column: "name", order: "desc" },
				},
				"name",
			);

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
			const last3 = await q(
				{
					tableName,
					pagination: { after: "00000001-0000-0004-0000-000000000004,DDDD" },
					orderBy: { column: "name", order: "desc" },
				},
				"name",
			);

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
