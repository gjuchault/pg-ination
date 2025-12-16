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
						order: [{ column: "id", order: "desc" }],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
						],
						order: [{ column: "id", order: "desc" }],
					},
					hasNextPageNullColumn: undefined,
					hasPreviousPageNullColumn: undefined,
					order: [{ column: "id", order: "desc" }],
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
						order: [{ column: "id", order: "desc" }],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
						],
						order: [{ column: "id", order: "desc" }],
					},
					hasNextPageNullColumn: undefined,
					hasPreviousPageNullColumn: undefined,
					order: [
						{
							column: "id",
							order: "desc",
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
						order: [{ column: "id", order: "asc" }],
					},
					hasPreviousPage: {
						filters: [
							{
								left: ["subquery.id"],
								operator: ">",
								right: ["data.id"],
							},
						],
						order: [{ column: "id", order: "asc" }],
					},
					hasNextPageNullColumn: undefined,
					hasPreviousPageNullColumn: undefined,
					order: [{ column: "id", order: "asc" }],
				},
			);
		});
	});

	await describe("given arbitrary order, asc", async () => {
		await test("when called getting first page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "asc" },
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
							},
							{
								column: "subquery.id",
								order: "asc",
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
							},
							{
								column: "subquery.id",
								order: "asc",
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
							},
							{
								column: "subquery.id",
								order: "asc",
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
							},
							{
								column: "subquery.id",
								order: "asc",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "asc",
						},
						{
							column: "data.id",
							order: "asc",
						},
					],
				},
			);
		});

		await test("when called getting second page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "asc" },
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
							},
							{
								column: "subquery.id",
								order: "asc",
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
							},
							{
								column: "subquery.id",
								order: "asc",
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
							},
							{
								column: "subquery.id",
								order: "asc",
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
							},
							{
								column: "subquery.id",
								order: "asc",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "asc",
						},
						{
							column: "data.id",
							order: "asc",
						},
					],
				},
			);
		});

		await test("when called getting back to first page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "asc" },
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
							},
							{
								column: "subquery.id",
								order: "desc",
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
							},
							{
								column: "subquery.id",
								order: "desc",
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
							},
							{
								column: "subquery.id",
								order: "desc",
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
							},
							{
								column: "subquery.id",
								order: "desc",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "desc",
						},
						{
							column: "data.id",
							order: "desc",
						},
					],
				},
			);
		});

		await test("when called with an invalid cursor", () => {
			const foo = paginate({
				tableName: "data",
				orderBy: { column: "name", order: "asc" },
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
						},
						{
							column: "subquery.id",
							order: "desc",
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
						},
						{
							column: "subquery.id",
							order: "desc",
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
						},
						{
							column: "subquery.id",
							order: "desc",
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
						},
						{
							column: "subquery.id",
							order: "desc",
						},
					],
				},
				order: [
					{
						column: "data.name",
						order: "desc",
					},
					{
						column: "data.id",
						order: "desc",
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
					orderBy: { column: "name", order: "desc" },
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
							},
							{
								column: "subquery.id",
								order: "desc",
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
							},
							{
								column: "subquery.id",
								order: "desc",
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
							},
							{
								column: "subquery.id",
								order: "desc",
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
							},
							{
								column: "subquery.id",
								order: "desc",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "desc",
						},
						{
							column: "data.id",
							order: "desc",
						},
					],
				},
			);
		});

		await test("when called getting second page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "desc" },
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
							},
							{
								column: "subquery.id",
								order: "desc",
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
							},
							{
								column: "subquery.id",
								order: "desc",
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
							},
							{
								column: "subquery.id",
								order: "desc",
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
							},
							{
								column: "subquery.id",
								order: "desc",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "desc",
						},
						{
							column: "data.id",
							order: "desc",
						},
					],
				},
			);
		});

		await test("when called getting back to first page", () => {
			deepEqual(
				paginate({
					tableName: "data",
					orderBy: { column: "name", order: "desc" },
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
							},
							{
								column: "subquery.id",
								order: "asc",
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
							},
							{
								column: "subquery.id",
								order: "asc",
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
							},
							{
								column: "subquery.id",
								order: "asc",
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
							},
							{
								column: "subquery.id",
								order: "asc",
							},
						],
					},
					order: [
						{
							column: "data.name",
							order: "asc",
						},
						{
							column: "data.id",
							order: "asc",
						},
					],
				},
			);
		});
	});
});
