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

	await it("should sort string cursors (UUIDs) desc by default", () => {
		const items = [
			{ cursor: "01234567-89ab-cdef-0123-456789abcdef", name: "Alice" },
			{ cursor: "fedcba98-7654-3210-fedc-ba9876543210", name: "Bob" },
			{ cursor: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", name: "Charlie" },
		];
		const result = toSorted(items);
		deepEqual(result, [
			{ cursor: "fedcba98-7654-3210-fedc-ba9876543210", name: "Bob" },
			{ cursor: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", name: "Charlie" },
			{ cursor: "01234567-89ab-cdef-0123-456789abcdef", name: "Alice" },
		]);
	});

	await it("should handle numeric column values in cursor", () => {
		const items = [
			{ cursor: "100,id1", name: "Alice" },
			{ cursor: "20,id2", name: "Bob" },
			{ cursor: "5,id3", name: "Charlie" },
		];
		const result = toSorted(items, { column: "value", order: "asc" });
		deepEqual(result, [
			{ cursor: "5,id3", name: "Charlie" },
			{ cursor: "20,id2", name: "Bob" },
			{ cursor: "100,id1", name: "Alice" },
		]);
	});

	await it("should handle numeric column values in descending order", () => {
		const items = [
			{ cursor: "5,id1", name: "Alice" },
			{ cursor: "20,id2", name: "Bob" },
			{ cursor: "100,id3", name: "Charlie" },
		];
		const result = toSorted(items, { column: "value", order: "desc" });
		deepEqual(result, [
			{ cursor: "100,id3", name: "Charlie" },
			{ cursor: "20,id2", name: "Bob" },
			{ cursor: "5,id1", name: "Alice" },
		]);
	});

	await it("should handle mixed string and number cursors without orderBy", () => {
		const items = [
			{ cursor: "abc", name: "Alice" },
			{ cursor: 123, name: "Bob" },
			{ cursor: "xyz", name: "Charlie" },
		];
		const result = toSorted(items);
		deepEqual(result, [
			{ cursor: "xyz", name: "Charlie" },
			{ cursor: "abc", name: "Alice" },
			{ cursor: 123, name: "Bob" },
		]);
	});

	await it("should use id for tie-breaking when column values are equal", () => {
		const items = [
			{ cursor: "100,id3", name: "Alice" },
			{ cursor: "100,id1", name: "Bob" },
			{ cursor: "100,id2", name: "Charlie" },
		];
		const result = toSorted(items, { column: "value", order: "asc" });
		deepEqual(result, [
			{ cursor: "100,id1", name: "Bob" },
			{ cursor: "100,id2", name: "Charlie" },
			{ cursor: "100,id3", name: "Alice" },
		]);
	});

	await it("should not mutate original array", () => {
		const items = [
			{ cursor: 1, name: "Alice" },
			{ cursor: 3, name: "Bob" },
			{ cursor: 2, name: "Charlie" },
		];
		const original = [...items];
		toSorted(items);
		deepEqual(items, original);
	});
});
