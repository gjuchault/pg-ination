import { deepEqual } from "node:assert/strict";
import { describe, it } from "node:test";

import { toSorted } from "../sort.ts";

await describe("toSorted()", async () => {
	await it("should sort by cursor desc by default", () => {
		const items = [
			{ cursor: 1, name: "Alice" },
			{ cursor: 3, name: "Bob" },
			{ cursor: 2, name: "Charlie" },
		];

		const result = toSorted(items);
		deepEqual(result, [
			{ cursor: 3, name: "Bob" },
			{ cursor: 2, name: "Charlie" },
			{ cursor: 1, name: "Alice" },
		]);
	});

	await it("should sort by specified column in ascending order", () => {
		const items = [
			{ cursor: "Charlie,1", name: "Charlie" },
			{ cursor: "Alice,2", name: "Alice" },
			{ cursor: "Bob,3", name: "Bob" },
		];

		const result = toSorted(items, { column: "name", order: "asc" });
		deepEqual(result, [
			{ cursor: "Alice,2", name: "Alice" },
			{ cursor: "Bob,3", name: "Bob" },
			{ cursor: "Charlie,1", name: "Charlie" },
		]);
	});

	await it("should sort by specified column in descending order", () => {
		const items = [
			{ cursor: "Alice,1", name: "Alice" },
			{ cursor: "Bob,2", name: "Bob" },
			{ cursor: "Charlie,3", name: "Charlie" },
		];

		const result = toSorted(items, { column: "name", order: "desc" });
		deepEqual(result, [
			{ cursor: "Charlie,3", name: "Charlie" },
			{ cursor: "Bob,2", name: "Bob" },
			{ cursor: "Alice,1", name: "Alice" },
		]);
	});

	await it("should handle empty arrays", () => {
		const items: { cursor: number; name: string }[] = [];
		const result = toSorted(items);
		deepEqual(result, []);
	});

	await it("should handle arrays with single item", () => {
		const items = [{ cursor: 1, name: "Alice" }];
		const result = toSorted(items);
		deepEqual(result, [{ cursor: 1, name: "Alice" }]);
	});

	await it("should handle arrays with duplicate values", () => {
		const items = [
			{ cursor: "Alice,1", name: "Alice" },
			{ cursor: "Alice,2", name: "Alice" },
			{ cursor: "Bob,3", name: "Bob" },
		];

		const result = toSorted(items, { column: "name", order: "asc" });
		deepEqual(result, [
			{ cursor: "Alice,1", name: "Alice" },
			{ cursor: "Alice,2", name: "Alice" },
			{ cursor: "Bob,3", name: "Bob" },
		]);
	});
});
