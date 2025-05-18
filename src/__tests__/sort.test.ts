import { deepEqual } from "node:assert/strict";
import { describe, it } from "node:test";

import { toSorted } from "../sort.ts";

await describe("toSorted()", async () => {
	await it("should sort by id desc by default", () => {
		const items = [
			{ id: 1, name: "Alice" },
			{ id: 3, name: "Bob" },
			{ id: 2, name: "Charlie" },
		];

		const result = toSorted(items);
		deepEqual(result, [
			{ id: 3, name: "Bob" },
			{ id: 2, name: "Charlie" },
			{ id: 1, name: "Alice" },
		]);
	});

	await it("should sort by specified column in ascending order", () => {
		const items = [
			{ id: 1, name: "Charlie" },
			{ id: 2, name: "Alice" },
			{ id: 3, name: "Bob" },
		];

		const result = toSorted(items, { column: "name", order: "asc" });
		deepEqual(result, [
			{ id: 2, name: "Alice" },
			{ id: 3, name: "Bob" },
			{ id: 1, name: "Charlie" },
		]);
	});

	await it("should sort by specified column in descending order", () => {
		const items = [
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Bob" },
			{ id: 3, name: "Charlie" },
		];

		const result = toSorted(items, { column: "name", order: "desc" });
		deepEqual(result, [
			{ id: 3, name: "Charlie" },
			{ id: 2, name: "Bob" },
			{ id: 1, name: "Alice" },
		]);
	});

	await it("should handle empty arrays", () => {
		const items: { id: number; name: string }[] = [];
		const result = toSorted(items);
		deepEqual(result, []);
	});

	await it("should handle arrays with single item", () => {
		const items = [{ id: 1, name: "Alice" }];
		const result = toSorted(items);
		deepEqual(result, [{ id: 1, name: "Alice" }]);
	});

	await it("should handle arrays with duplicate values", () => {
		const items = [
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Alice" },
			{ id: 3, name: "Bob" },
		];

		const result = toSorted(items, { column: "name", order: "asc" });
		deepEqual(result, [
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Alice" },
			{ id: 3, name: "Bob" },
		]);
	});
});
