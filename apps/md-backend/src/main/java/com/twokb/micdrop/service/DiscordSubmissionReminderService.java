package com.twokb.micdrop.service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.twokb.micdrop.dto.DiscordSubmissionReminderConfig;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;

@Service
@RequiredArgsConstructor
@Slf4j
public class DiscordSubmissionReminderService {

	static final List<Integer> DEFAULT_REMINDER_HOURS = List.of(24, 12, 6, 1);

	private static final String CHANNEL_KEY = "submission_reminder_channel_id";

	private static final String DEADLINE_KEY = "submission_reminder_deadline";

	private static final String ENABLED_KEY = "submission_reminder_enabled";

	private static final String STATE_KEY = "submission_reminder_state";

	private final JDA jda;

	private final SystemSettingService systemSettingService;

	private final RoundService roundService;

	private final UserRoundService userRoundService;

	private final SubmissionService submissionService;

	private record PendingContestant(DiscordUser user, long songCount) {
	}

	public DiscordSubmissionReminderConfig configure(String channelId, Instant deadline, String requesterDiscordId) {
		if (deadline == null || !deadline.isAfter(Instant.now())) {
			throw new IllegalArgumentException("Submission deadline must be in the future.");
		}
		if (jda.getTextChannelById(channelId) == null) {
			throw new IllegalArgumentException("Channel with ID " + channelId + " not found.");
		}

		systemSettingService.upsertSettings(
				Map.of(CHANNEL_KEY, channelId, DEADLINE_KEY, deadline.toString(), ENABLED_KEY, Boolean.TRUE.toString(),
						STATE_KEY, ""),
				requesterDiscordId);
		return getConfig();
	}

	public DiscordSubmissionReminderConfig disable(String requesterDiscordId) {
		systemSettingService.upsertSettings(Map.of(ENABLED_KEY, Boolean.FALSE.toString()), requesterDiscordId);
		return getConfig();
	}

	public DiscordSubmissionReminderConfig getConfig() {
		String channelId = systemSettingService.getSetting(CHANNEL_KEY).orElse("");
		Instant deadline = systemSettingService.getSetting(DEADLINE_KEY).flatMap(this::parseInstant).orElse(null);
		boolean enabled = systemSettingService.getSetting(ENABLED_KEY).map(Boolean::parseBoolean).orElse(false);
		return new DiscordSubmissionReminderConfig(channelId, deadline, enabled, DEFAULT_REMINDER_HOURS);
	}

	@Scheduled(fixedDelayString = "${micdrop.discord.submission-reminder-check-ms:60000}")
	public void sendDueReminder() {
		try {
			sendDueReminder(Instant.now());
		}
		catch (RuntimeException exception) {
			log.error("Unable to process automatic Discord submission reminders.", exception);
		}
	}

	void sendDueReminder(Instant now) {
		DiscordSubmissionReminderConfig config = getConfig();
		if (!config.enabled() || config.deadline() == null || !config.deadline().isAfter(now)) {
			return;
		}

		Round activeRound = roundService.getActiveRound();
		if (!Boolean.TRUE.equals(activeRound.getSubmissionsOpen())) {
			return;
		}

		long secondsRemaining = Duration.between(now, config.deadline()).getSeconds();
		List<Integer> dueHours = DEFAULT_REMINDER_HOURS.stream()
			.filter(hours -> secondsRemaining <= Duration.ofHours(hours).getSeconds())
			.toList();
		if (dueHours.isEmpty()) {
			return;
		}

		String statePrefix = activeRound.getIdRound() + "|" + config.deadline().getEpochSecond() + "|";
		Set<Integer> sentHours = parseSentHours(statePrefix);
		List<Integer> unsentDueHours = dueHours.stream().filter(hours -> !sentHours.contains(hours)).toList();
		if (unsentDueHours.isEmpty()) {
			return;
		}

		int currentThreshold = unsentDueHours.get(unsentDueHours.size() - 1);
		List<PendingContestant> pendingContestants = getPendingContestants(activeRound);

		// Mark every elapsed threshold so a late start produces only one relevant ping.
		sentHours.addAll(dueHours);
		if (pendingContestants.isEmpty()) {
			saveState(statePrefix, sentHours);
			return;
		}

		TextChannel channel = jda.getTextChannelById(config.channelId());
		if (channel == null) {
			throw new IllegalStateException("Configured submission reminder channel was not found.");
		}

		String message = buildMessage(activeRound, config.deadline(), currentThreshold, pendingContestants);
		channel.sendMessage(message).queue();
		saveState(statePrefix, sentHours);
	}

	private void saveState(String statePrefix, Set<Integer> sentHours) {
		systemSettingService.setInternalSetting(STATE_KEY,
				statePrefix + sentHours.stream().sorted(Comparator.reverseOrder()).map(String::valueOf)
					.reduce((left, right) -> left + "," + right)
					.orElse(""));
	}

	private List<PendingContestant> getPendingContestants(Round activeRound) {
		List<UserRound> assignments = userRoundService.getUserRoundsByRoundId(activeRound.getIdRound());
		Map<Integer, Long> judgeCountByGroup = assignments.stream()
			.filter(assignment -> assignment.getUserRole() == UserRoleType.JUDGE)
			.collect(Collectors.groupingBy(UserRound::getGroupNumber, Collectors.counting()));

		return assignments.stream()
			.filter(assignment -> assignment.getUserRole() == UserRoleType.CONTESTANT)
			.map(assignment -> {
				long requiredSongs = judgeCountByGroup.getOrDefault(assignment.getGroupNumber(), 0L);
				long submittedSongs = submissionService.countSubmittedSongs(activeRound.getIdRound(),
						assignment.getUser().getIdUser());
				return new PendingContestant(assignment.getUser(), Math.max(0, requiredSongs - submittedSongs));
			})
			.filter(contestant -> contestant.songCount() > 0)
			.sorted(Comparator.comparing(contestant -> contestant.user().getUsername(),
					String.CASE_INSENSITIVE_ORDER))
			.toList();
	}

	private String buildMessage(Round round, Instant deadline, int currentThreshold,
			List<PendingContestant> contestants) {
		long deadlineEpoch = deadline.getEpochSecond();
		long totalSongs = contestants.stream().mapToLong(PendingContestant::songCount).sum();
		StringBuilder message = new StringBuilder();
		message.append("**Round ")
			.append(round.getRoundNumber())
			.append(" Submission Reminder**\n\n")
			.append("You have <t:")
			.append(deadlineEpoch)
			.append(":R> left to submit your songs.\n")
			.append("Deadline: <t:")
			.append(deadlineEpoch)
			.append(":F>\n")
			.append("Automatic ")
			.append(currentThreshold)
			.append("-hour reminder.\n\n")
			.append("**Yet to submit:**\n");

		for (PendingContestant contestant : contestants) {
			message.append("<@")
				.append(contestant.user().getDiscordId())
				.append("> - **")
				.append(contestant.songCount())
				.append(contestant.songCount() == 1 ? " song remaining**\n" : " songs remaining**\n");
		}

		message.append("\n**Total remaining: ")
			.append(totalSongs)
			.append(totalSongs == 1 ? " song**" : " songs**");

		if (message.length() > 2000) {
			throw new IllegalStateException("The submission reminder is too long to send as one Discord message.");
		}
		return message.toString();
	}

	private Set<Integer> parseSentHours(String expectedPrefix) {
		String state = systemSettingService.getSetting(STATE_KEY).orElse("");
		if (!state.startsWith(expectedPrefix)) {
			return new HashSet<>();
		}

		Set<Integer> hours = new HashSet<>();
		String serializedHours = state.substring(expectedPrefix.length());
		for (String value : serializedHours.split(",")) {
			try {
				hours.add(Integer.parseInt(value));
			}
			catch (NumberFormatException ignored) {
				// Ignore malformed state and continue with valid thresholds.
			}
		}
		return hours;
	}

	private Optional<Instant> parseInstant(String value) {
		try {
			return Optional.of(Instant.parse(value));
		}
		catch (RuntimeException exception) {
			return Optional.empty();
		}
	}

}
