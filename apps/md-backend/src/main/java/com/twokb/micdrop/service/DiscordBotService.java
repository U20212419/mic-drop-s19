package com.twokb.micdrop.service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;

import com.twokb.micdrop.dto.DiscordJudgingReminderResponse;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.UserRoleType;

import lombok.RequiredArgsConstructor;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.entities.emoji.Emoji;

@Service
@RequiredArgsConstructor
public class DiscordBotService {

	private final JDA jda;

	private final SystemSettingService systemSetting;

	private final RoundService roundService;

	private final UserRoundService userRoundService;

	private final SubmissionService submissionService;

	private record PendingJudge(DiscordUser user, long songCount) {
	}

	public void sendSignUpMessage(String channelId, String requesterDiscordId) {
		String hostId = systemSetting.getHostDiscordId();
		if (!requesterDiscordId.equals(hostId)) {
			throw new IllegalStateException("Only the host can send the signup message.");
		}

		TextChannel channel = jda.getTextChannelById(channelId);

		if (channel != null) {
			String messageText = "**Season XIX Contestant**\n" + "React to give yourself a role.\n\n"
					+ "☠️: ``Season XIX Contestant``";

			channel.sendMessage(messageText).queue(message -> {
				// Add the specific emoji reaction to the message
				message.addReaction(Emoji.fromUnicode("☠️")).queue();

				// Store the message ID in database
				systemSetting.setSetting("signup_message_id", message.getId(), requesterDiscordId);
			});
		}
		else {
			throw new IllegalArgumentException("Channel with ID " + channelId + " not found.");
		}
	}

	public DiscordJudgingReminderResponse sendJudgingReminder(String channelId, Instant deadline,
			String requesterDiscordId) {
		String hostId = systemSetting.getHostDiscordId();
		if (!requesterDiscordId.equals(hostId)) {
			throw new IllegalStateException("Only the host can send judging reminders.");
		}
		if (deadline == null || !deadline.isAfter(Instant.now())) {
			throw new IllegalArgumentException("Judging deadline must be in the future.");
		}

		TextChannel channel = jda.getTextChannelById(channelId);
		if (channel == null) {
			throw new IllegalArgumentException("Channel with ID " + channelId + " not found.");
		}

		Round activeRound = roundService.getActiveRound();
		List<PendingJudge> pendingJudges = userRoundService.getUserRoundsByRoundId(activeRound.getIdRound())
			.stream()
			.filter(userRound -> userRound.getUserRole() == UserRoleType.JUDGE)
			.map(userRound -> new PendingJudge(userRound.getUser(),
					submissionService.countPendingJudgeSubmissions(activeRound.getIdRound(),
							userRound.getUser().getIdUser())))
			.filter(judge -> judge.songCount() > 0)
			.sorted(Comparator.comparing(judge -> judge.user().getUsername(), String.CASE_INSENSITIVE_ORDER))
			.toList();

		if (pendingJudges.isEmpty()) {
			throw new IllegalStateException("There are no judges with pending songs in the active round.");
		}

		long deadlineEpoch = deadline.getEpochSecond();
		long totalSongsRemaining = pendingJudges.stream().mapToLong(PendingJudge::songCount).sum();

		StringBuilder message = new StringBuilder();
		message.append("**Round ")
			.append(activeRound.getRoundNumber())
			.append(" Judging Reminder**\n\n")
			.append("Judges, the deadline to finish judging is <t:")
			.append(deadlineEpoch)
			.append(":R>.\n")
			.append("Deadline: <t:")
			.append(deadlineEpoch)
			.append(":F>\n\n")
			.append("**Songs remaining:**\n");

		for (PendingJudge judge : pendingJudges) {
			message.append("<@")
				.append(judge.user().getDiscordId())
				.append("> - **")
				.append(judge.songCount())
				.append(judge.songCount() == 1 ? " song**\n" : " songs**\n");
		}

		message.append("\n**Total remaining: ")
			.append(totalSongsRemaining)
			.append(totalSongsRemaining == 1 ? " song**" : " songs**");

		if (message.length() > 2000) {
			throw new IllegalStateException("The judging reminder is too long to send as one Discord message.");
		}

		channel.sendMessage(message.toString()).queue();

		return new DiscordJudgingReminderResponse(activeRound.getRoundNumber(), pendingJudges.size(),
				totalSongsRemaining, channelId);
	}

}
