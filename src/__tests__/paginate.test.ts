import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";
import { paginate } from "../paginate.ts";

await describe("paginate()", async () => {
	await describe("given no ordering", async () => {
		await test("when called getting first page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: undefined,
					pagination: undefined,
				}),
				{
					cursor: ["data.id"],
					filter: undefined,
					hasNextPage: {
						filters: [
							{
								left: ["subquery.id"],
								operator: "<",
								right: ["data.id"],
							},
						],
						order: [{ column: "id", order: "desc", type: "text" }],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
						],
						order: [{ column: "id", order: "desc", type: "text" }],
					},
					hasNextPageNullColumn: undefined,
					hasPreviousPageNullColumn: undefined,
					order: [{ column: "id", order: "desc", type: "text" }],
				},
			);
		});

		await test("when called getting second page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: undefined,
					pagination: { after: "00000001-0000-0009-0000-000000000009" },
				}),
				{
					cursor: ["data.id"],
					filter: {
						left: ["data.id"],
						operator: "<",
						right: ["00000001-0000-0009-0000-000000000009"],
					},
					hasNextPage: {
						filters: [
							{
								left: ["subquery.id"],
								operator: "<",
								right: ["data.id"],
							},
						],
						order: [{ column: "id", order: "desc", type: "text" }],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
						],
						order: [{ column: "id", order: "desc", type: "text" }],
					},
					hasNextPageNullColumn: undefined,
					hasPreviousPageNullColumn: undefined,
					order: [
						{
							column: "id",
							order: "desc",
							type: "text",
						},
					],
				},
			);
		});

		await test("when called getting back to first page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: undefined,
					pagination: { before: "00000001-0000-0009-0000-000000000009" },
				}),
				{
					cursor: ["data.id"],
					filter: {
						left: ["data.id"],
						operator: ">",
						right: ["00000001-0000-0009-0000-000000000009"],
					},
					hasNextPage: {
						filters: [
							{
								left: ["subquery.id"],
								operator: "<",
								right: ["data.id"],
							},
						],
						order: [{ column: "id", order: "asc", type: "text" }],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
						],
						order: [{ column: "id", order: "asc", type: "text" }],
					},
					hasNextPageNullColumn: undefined,
					hasPreviousPageNullColumn: undefined,
					order: [{ column: "id", order: "asc", type: "text" }],
				},
			);
		});
	});

	await describe("given arbitrary order, asc", async () => {
		await test("when called getting first page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "asc", type: "text" },
					pagination: undefined,
				}),
				{
					cursor: ["data.name", "data.id"],
					filter: undefined,
					hasNextPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: ">",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					hasNextPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: "<",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					hasPreviousPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: "<",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "asc",
							type: "text",
						},
						{
							column: "data.id",
							order: "asc",
							type: "text",
						},
					],
				},
			);
		});

		await test("when called getting second page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "asc", type: "text" },
					pagination: { after: "CCCC,00000001-0000-0009-0000-000000000009" },
				}),
				{
					cursor: ["data.name", "data.id"],
					filter: {
						left: ["data.name", "data.id"],
						operator: ">",
						right: ["CCCC", "00000001-0000-0009-0000-000000000009"],
					},
					hasNextPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: ">",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: "<",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					hasNextPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					hasPreviousPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: "<",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "asc",
							type: "text",
						},
						{
							column: "data.id",
							order: "asc",
							type: "text",
						},
					],
				},
			);
		});

		await test("when called getting back to first page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "asc", type: "text" },
					pagination: { before: "CCCC,00000001-0000-0009-0000-000000000009" },
				}),
				{
					cursor: ["data.name", "data.id"],
					filter: {
						left: ["data.name", "data.id"],
						operator: "<",
						right: ["CCCC", "00000001-0000-0009-0000-000000000009"],
					},
					hasNextPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: ">",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					hasNextPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: "<",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					hasPreviousPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: "<",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "desc",
							type: "text",
						},
						{
							column: "data.id",
							order: "desc",
							type: "text",
						},
					],
				},
			);
		});

		await test("when called with an invalid cursor", () => {
			const foo = paginate({
				tableName: "data",
				orderBy: { column: "name", order: "asc", type: "text" },
				pagination: { before: "00000001-0000-0009-0000-000000000009" },
			});
			deepEqual(foo, {
				cursor: ["data.name", "data.id"],
				filter: {
					left: ["data.name", "data.id"],
					operator: "<",
					right: ["", "00000001-0000-0009-0000-000000000009"],
				},
				hasNextPage: {
					filters: [
						{
							left: ["subquery.name", "subquery.id"],
							operator: ">",
							right: ["data.name", "data.id"],
						},
					],
					order: [
						{
							column: "subquery.name",
							order: "desc",
							type: "text",
						},
						{
							column: "subquery.id",
							order: "desc",
							type: "text",
						},
					],
				},
				hasNextPageNullColumn: {
					filters: [
						{
							left: ["subquery.id"],
							operator: ">",
							right: ["data.id"],
						},
						{
							left: ["subquery.name"],
							operator: "is null",
						},
					],
					order: [
						{
							column: "subquery.name",
							order: "desc",
							type: "text",
						},
						{
							column: "subquery.id",
							order: "desc",
							type: "text",
						},
					],
				},
				hasPreviousPage: {
					filters: [
						{
							left: ["subquery.name", "subquery.id"],
							operator: "<",
							right: ["data.name", "data.id"],
						},
					],
					order: [
						{
							column: "subquery.name",
							order: "desc",
							type: "text",
						},
						{
							column: "subquery.id",
							order: "desc",
							type: "text",
						},
					],
				},
				hasPreviousPageNullColumn: {
					filters: [
						{
							left: ["subquery.id"],
							operator: "<",
							right: ["data.id"],
						},
						{
							left: ["subquery.name"],
							operator: "is null",
						},
					],
					order: [
						{
							column: "subquery.name",
							order: "desc",
							type: "text",
						},
						{
							column: "subquery.id",
							order: "desc",
							type: "text",
						},
					],
				},
				order: [
					{
						column: "data.name",
						order: "desc",
						type: "text",
					},
					{
						column: "data.id",
						order: "desc",
						type: "text",
					},
				],
			});
		});
	});

	await describe("given arbitrary order, desc", async () => {
		await test("when called getting first page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "desc", type: "text" },
					pagination: undefined,
				}),
				{
					cursor: ["data.name", "data.id"],
					filter: undefined,
					hasNextPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: "<",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: ">",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					hasNextPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: "<",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					hasPreviousPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "desc",
							type: "text",
						},
						{
							column: "data.id",
							order: "desc",
							type: "text",
						},
					],
				},
			);
		});

		await test("when called getting second page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "desc", type: "text" },
					pagination: { after: "CCCC,00000001-0000-0009-0000-000000000009" },
				}),
				{
					cursor: ["data.name", "data.id"],
					filter: {
						left: ["data.name", "data.id"],
						operator: "<",
						right: ["CCCC", "00000001-0000-0009-0000-000000000009"],
					},
					hasNextPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: "<",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					hasNextPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: "<",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: ">",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					hasPreviousPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "desc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "desc",
								type: "text",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "desc",
							type: "text",
						},
						{
							column: "data.id",
							order: "desc",
							type: "text",
						},
					],
				},
			);
		});

		await test("when called getting back to first page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "desc", type: "text" },
					pagination: { before: "CCCC,00000001-0000-0009-0000-000000000009" },
				}),
				{
					cursor: ["data.name", "data.id"],
					filter: {
						left: ["data.name", "data.id"],
						operator: ">",
						right: ["CCCC", "00000001-0000-0009-0000-000000000009"],
					},
					hasNextPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: "<",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.name", "subquery.id"],
								operator: ">",
								right: ["data.name", "data.id"],
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					hasNextPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: "<",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					hasPreviousPageNullColumn: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
							{
								left: ["subquery.name"],
								operator: "is null",
							},
						],
						order: [
							{
								column: "subquery.name",
								order: "asc",
								type: "text",
							},
							{
								column: "subquery.id",
								order: "asc",
								type: "text",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "asc",
							type: "text",
						},
						{
							column: "data.id",
							order: "asc",
							type: "text",
						},
					],
				},
			);
		});
	});
});
