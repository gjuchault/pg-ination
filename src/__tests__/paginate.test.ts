import { describe, test } from "node:test";
import { deepEqual } from "node:assert/strict";

import { paginate } from "../paginate.ts";
import { throws } from "node:assert/strict";

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
						filter: {
							left: ["subquery.id"],
							operator: "<",
							right: ["data.id"],
						},
						order: [{ column: "id", order: "desc" }],
					},
					hasPreviousPage: {
						filter: {
							left: ["subquery.id"],
							operator: ">",
							right: ["data.id"],
						},
						order: [{ column: "id", order: "desc" }],
					},
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
						filter: {
							left: ["subquery.id"],
							operator: "<",
							right: ["data.id"],
						},
						order: [{ column: "id", order: "desc" }],
					},
					hasPreviousPage: {
						filter: {
							left: ["subquery.id"],
							operator: ">",
							right: ["data.id"],
						},
						order: [{ column: "id", order: "desc" }],
					},
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
						filter: {
							left: ["subquery.id"],
							operator: "<",
							right: ["data.id"],
						},
						order: [{ column: "id", order: "asc" }],
					},
					hasPreviousPage: {
						filter: {
							left: ["subquery.id"],
							operator: ">",
							right: ["data.id"],
						},
						order: [{ column: "id", order: "asc" }],
					},
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
					cursor: ["data.id", "data.name"],
					filter: undefined,
					hasNextPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: ">",
							right: ["data.name", "data.id"],
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
					hasPreviousPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: "<",
							right: ["data.name", "data.id"],
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
					pagination: { after: "00000001-0000-0009-0000-000000000009,CCCC" },
				}),
				{
					cursor: ["data.id", "data.name"],
					filter: {
						left: ["data.name", "data.id"],
						operator: ">",
						right: ["CCCC", "00000001-0000-0009-0000-000000000009"],
					},
					hasNextPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: ">",
							right: ["data.name", "data.id"],
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
					hasPreviousPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: "<",
							right: ["data.name", "data.id"],
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
					pagination: { before: "00000001-0000-0009-0000-000000000009,CCCC" },
				}),
				{
					cursor: ["data.id", "data.name"],
					filter: {
						left: ["data.name", "data.id"],
						operator: "<",
						right: ["CCCC", "00000001-0000-0009-0000-000000000009"],
					},
					hasNextPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: ">",
							right: ["data.name", "data.id"],
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
					hasPreviousPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: "<",
							right: ["data.name", "data.id"],
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
			throws(
				() =>
					paginate({
						tableName: "data",
						orderBy: { column: "name", order: "asc" },
						pagination: { before: "00000001-0000-0009-0000-000000000009" },
					}),
				new Error("Invalid cursor"),
			);
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
					cursor: ["data.id", "data.name"],
					filter: undefined,
					hasNextPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: "<",
							right: ["data.name", "data.id"],
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
					hasPreviousPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: ">",
							right: ["data.name", "data.id"],
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
					pagination: { after: "00000001-0000-0009-0000-000000000009,CCCC" },
				}),
				{
					cursor: ["data.id", "data.name"],
					filter: {
						left: ["data.name", "data.id"],
						operator: "<",
						right: ["CCCC", "00000001-0000-0009-0000-000000000009"],
					},
					hasNextPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: "<",
							right: ["data.name", "data.id"],
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
					hasPreviousPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: ">",
							right: ["data.name", "data.id"],
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
					pagination: { before: "00000001-0000-0009-0000-000000000009,CCCC" },
				}),
				{
					cursor: ["data.id", "data.name"],
					filter: {
						left: ["data.name", "data.id"],
						operator: ">",
						right: ["CCCC", "00000001-0000-0009-0000-000000000009"],
					},
					hasNextPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: "<",
							right: ["data.name", "data.id"],
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
					hasPreviousPage: {
						filter: {
							left: ["subquery.name", "subquery.id"],
							operator: ">",
							right: ["data.name", "data.id"],
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
