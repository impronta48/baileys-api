/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MakeSerializedPrisma, MakeTransformedPrisma } from "@/types/prisma";
import { toNumber } from "@whiskeysockets/baileys";
import Long from "long";

/** Transform object props value into Prisma-supported types */
export function transformPrisma<T extends Record<string, any>>(
	data: T,
	removeNullable = true,
): MakeTransformedPrisma<T> {
	const obj = { ...data } as any;

	for (const [key, val] of Object.entries(obj)) {
		if (val instanceof Uint8Array) {
			obj[key] = Buffer.from(val);
		} else if (typeof val === "number" || val instanceof Long) {
			obj[key] = toNumber(val);
		} else if (typeof val === "bigint") {
			obj[key] = Number(val);
		} else if (removeNullable && (typeof val === "undefined" || val === null)) {
			delete obj[key];
		}
	}

	return obj;
}

/** Transform prisma result into JSON serializable types */
export function serializePrisma<T extends Record<string, any>>(
	data: T,
	removeNullable = true,
): MakeSerializedPrisma<T> {
	const obj = { ...data } as any;

	for (const [key, val] of Object.entries(obj)) {
		if (val instanceof Buffer) {
			obj[key] = val.toJSON();
		} else if (typeof val === "bigint") {
			obj[key] = val.toString();
		} else if (removeNullable && (typeof val === "undefined" || val === null)) {
			delete obj[key];
		}
	}

	return obj;
}
