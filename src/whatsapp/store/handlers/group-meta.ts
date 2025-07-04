/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/config/database";
import type { BaileysEventHandler, MakeTransformedPrisma } from "@/types";
import { emitEvent, logger, transformPrisma } from "@/utils";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { BaileysEventEmitter, GroupMetadata } from "@whiskeysockets/baileys";

export default function groupMetadataHandler(sessionId: string, event: BaileysEventEmitter) {
	const model = prisma.groupMetadata;
	let listening = false;

	const upsert: BaileysEventHandler<"groups.upsert"> = async (groups) => {
		try {
			const results: MakeTransformedPrisma<GroupMetadata>[] = [];
			await Promise.any(
				groups
					.map((g) => transformPrisma(g))
					.map((data) => {
						model.upsert({
							select: { pkId: true },
							create: { ...data, sessionId },
							update: data,
							where: { sessionId_id: { id: data.id, sessionId } },
						});
						results.push(data);
					}),
			);
			emitEvent("groups.upsert", sessionId, { groups: results });
		} catch (e) {
			logger.error(e, "An error occured during groups upsert");
			//TODO: controllo su e per evitare errore in fase di build
			let message = '';
			if (e instanceof Error) {
				message = e.message;
			}
			emitEvent(
				"groups.upsert",
				sessionId,
				undefined,
				"error",
				`An error occured during groups upsert: ${message}`,
			);
		}
	};

	const update: BaileysEventHandler<"groups.update"> = async (updates) => {
		for (const update of updates) {
			try {
				const data = transformPrisma(update);
				await model.update({
					select: { pkId: true },
					data: data,
					where: { sessionId_id: { id: update.id!, sessionId } },
				});
				emitEvent("groups.update", sessionId, { groups: data });
			} catch (e) {
				if (e instanceof PrismaClientKnownRequestError && e.code === "P2025")
					return logger.info({ update }, "Got metadata update for non existent group");
				logger.error(e, "An error occured during group metadata update");
				//TODO: controllo su e per evitare errore in fase di build
				let message = '';
				if (e instanceof Error) {
					message = e.message;
				}
				emitEvent(
					"groups.update",
					sessionId,
					undefined,
					"error",
					`An error occured during group metadata update: ${message}`,
				);
			}
		}
	};

	const updateParticipant: BaileysEventHandler<"group-participants.update"> = async ({
		id,
		action,
		participants,
	}) => {
		try {
			const metadata = ((await model.findFirst({
				select: { participants: true },
				where: { id, sessionId },
			})) || []) as { participants: any[] } | null;

			if (!metadata) {
				return logger.info(
					{ update: { id, action, participants } },
					"Got participants update for non existent group",
				);
			}

			if (!metadata.participants) {
				metadata.participants = [];
			}

			switch (action) {
				case "add":
					metadata.participants.push(
						...participants.map((id) => ({
							id,
							admin: null,
							isAdmin: false,
							isSuperAdmin: false,
						})),
					);
					break;
				case "demote":
				case "promote":
					for (const participant of metadata.participants) {
						if (participants.includes(participant.id)) {
							participant.admin = action === "promote" ? "admin" : null;
							participant.isAdmin = action === "promote";
						}
					}
					break;
				case "remove":
					metadata.participants = metadata.participants?.filter(
						(p) => !participants.includes(p.id),
					);
					break;
			}

			const processedParticipants = transformPrisma({ participants: metadata.participants });
			await model.update({
				select: { pkId: true },
				data: processedParticipants,
				where: { sessionId_id: { id, sessionId } },
			});
			emitEvent("group-participants.update", sessionId, {
				groupId: id,
				action,
				participants,
			});
		} catch (e) {
			logger.error(e, "An error occured during group participants update");
			//TODO: controllo su e per evitare errore in fase di build
			let message = '';
			if (e instanceof Error) {
				message = e.message;
			}
			emitEvent(
				"group-participants.update",
				sessionId,
				undefined,
				"error",
				`An error occured during group participants update: ${message}`,
			);
		}
	};

	const listen = () => {
		if (listening) return;

		event.on("groups.upsert", upsert);
		event.on("groups.update", update);
		event.on("group-participants.update", updateParticipant);
		listening = true;
	};

	const unlisten = () => {
		if (!listening) return;

		event.off("groups.upsert", upsert);
		event.off("groups.update", update);
		event.off("group-participants.update", updateParticipant);
		listening = false;
	};

	return { listen, unlisten };
}
