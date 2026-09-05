package com.twokb.micdrop.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
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
import net.dv8tion.jda.api.entities.Role;
import net.dv8tion.jda.api.entities.UserSnowflake;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;

@Service
@RequiredArgsConstructor
@Slf4j
public class DiscordSubmissionReminderService {

	static final List<Double> DEFAULT_REMINDER_HOURS = List.of(24.0, 12.0, 6.0, 1.0);

	private static final String CHANNEL_KEY = "submission_reminder_channel_id";

	private static final String DEADLINE_KEY = "submission_reminder_deadline";

	private static final String ENABLED_KEY = "submission_reminder_enabled";

	private static final String STATE_KEY = "submission_reminder_state";

	private static final String REMINDER_HOURS_KEY = "submission_reminder_hours";

	private final JDA jda;

	private final SystemSettingService systemSettingService;

	private final RoundService roundService;

	private final UserRoundService userRoundService;

	private final SubmissionService submissionService;

	private boolean errorAlreadyLogged = false;

	private record PendingContestant(DiscordUser user, long songCount) {
	}

	public DiscordSubmissionReminderConfig configure(String channelId, Instant deadline, List<Double> reminderHours,
			String requesterDiscordId) {
		if (deadline == null || !deadline.isAfter(Instant.now())) {
			throw new IllegalArgumentException("Submission deadline must be in the future.");
		}
		if (jda.getTextChannelById(channelId) == null) {
			throw new IllegalArgumentException("Channel with ID " + channelId + " not found.");
		}

		List<Double> cleanHours = (reminderHours != null && !reminderHours.isEmpty())
				? reminderHours.stream().sorted(Comparator.reverseOrder()).toList() : getReminderHours();

		String hoursString = cleanHours.stream().map(String::valueOf).collect(Collectors.joining(","));

		// Calculate what thresholds have already passed at the time of configuration
		Round activeRound = roundService.getActiveRound();
		String statePrefix = activeRound.getIdRound() + "|" + deadline.getEpochSecond() + "|";
		long secondsRemaining = Duration.between(Instant.now(), deadline).getSeconds();

		// Mark all thresholds that have already passed as sent, so we don't send them
		// again
		String initialSentState = statePrefix + cleanHours.stream()
			.filter(hours -> secondsRemaining <= (long) (hours * 3600))
			.map(String::valueOf)
			.collect(Collectors.joining(","));

		systemSettingService
			.upsertSettings(
					Map.of(CHANNEL_KEY, channelId, DEADLINE_KEY, deadline.toString(), ENABLED_KEY,
							Boolean.TRUE.toString(), STATE_KEY, initialSentState, REMINDER_HOURS_KEY, hoursString),
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
		return new DiscordSubmissionReminderConfig(channelId, deadline, enabled, getReminderHours());
	}

	@Scheduled(fixedDelayString = "${micdrop.discord.submission-reminder-check-ms:60000}")
	public void sendDueReminder() {
		try {
			sendDueReminder(Instant.now());

			if (errorAlreadyLogged) {
				log.info("Discord submission reminder service has recovered and is now running normally.");
				errorAlreadyLogged = false;
			}
		}
		catch (RuntimeException exception) {
			if (!errorAlreadyLogged) {
				log.error("Unable to process automatic Discord submission reminders.", exception);
				errorAlreadyLogged = true;
			}
		}
	}

	void sendDueReminder(Instant now) {
		DiscordSubmissionReminderConfig config = getConfig();
		if (!config.enabled() || config.deadline() == null) {
			return;
		}

		Round activeRound = roundService.getActiveRound();
		if (activeRound == null) {
			return;
		}

		long secondsRemaining = Duration.between(now, config.deadline()).getSeconds();
		boolean isDeadlineReached = secondsRemaining <= 0;
		boolean submissionsOpen = Boolean.TRUE.equals(activeRound.getSubmissionsOpen());

		// If submissions are closed, we only want to process the deadline, not at any
		// other thresholds
		String statePrefix = activeRound.getIdRound() + "|" + config.deadline().getEpochSecond() + "|";
		Set<Double> sentHours = parseSentHours(statePrefix);

		boolean deadlineProcessed = sentHours.contains(0.0);

		if (!submissionsOpen && deadlineProcessed) {
			return; // If submissions are closed and the deadline has already been
					// processed, do not send any more reminders
		}

		List<Double> dueHours = new ArrayList<>();

		if (submissionsOpen) {
			dueHours.addAll(config.reminderHours()
				.stream()
				.filter(hours -> secondsRemaining <= (long) (hours * 3600))
				.toList());
		}

		if (isDeadlineReached && !deadlineProcessed) {
			dueHours.add(0.0); // Add a 0-hour threshold to sync YTS role at the deadline
		}

		if (dueHours.isEmpty()) {
			return;
		}

		List<Double> unsentDueHours = dueHours.stream().filter(hours -> !sentHours.contains(hours)).toList();
		if (unsentDueHours.isEmpty()) {
			return;
		}

		double currentThreshold = unsentDueHours.get(unsentDueHours.size() - 1);

		List<UserRound> allAssignments = userRoundService.getUserRoundsByRoundId(activeRound.getIdRound());
		List<PendingContestant> pendingContestants = getPendingContestants(activeRound, allAssignments);

		sentHours.addAll(dueHours);

		TextChannel channel = jda.getTextChannelById(config.channelId());
		if (channel == null) {
			throw new IllegalStateException("Configured submission reminder channel was not found.");
		}

		// Sync YTS role for all contestants
		syncYetToSubmitRole(channel, allAssignments, pendingContestants);

		// If everyone submitted or if the current threshold is 0 (deadline reached),
		// don't send a reminder message
		if (pendingContestants.isEmpty() || currentThreshold == 0.0) {
			saveState(statePrefix, sentHours);
			return;
		}

		String message = buildMessage(activeRound, config.deadline(), currentThreshold);
		channel.sendMessage(message).queue();
		saveState(statePrefix, sentHours);
	}

	private List<Double> getReminderHours() {
		return systemSettingService.getSetting(REMINDER_HOURS_KEY).filter(val -> !val.isBlank()).map(val -> {
			try {
				return Arrays.stream(val.split(","))
					.map(String::trim)
					.map(Double::parseDouble)
					.filter(hours -> hours > 0)
					.sorted(Comparator.reverseOrder())
					.toList();
			}
			catch (NumberFormatException exception) {
				log.warn(
						"Invalid reminder hours configuration ('submission_reminder_hours'): '{}'. Using default values.",
						val);
				return null;
			}
		}).orElse(DEFAULT_REMINDER_HOURS);
	}

	private void syncYetToSubmitRole(TextChannel channel, List<UserRound> allAssignments,
			List<PendingContestant> pendingContestants) {
		String ytsRoleId = systemSettingService.getSetting("yts_role_id").orElse("");
		if (ytsRoleId.isEmpty()) {
			log.warn("YTS role ID ('yts_role_id') is not configured. Skipping YTS role synchronization.");
			return;
		}

		Role ytsRole = channel.getGuild().getRoleById(ytsRoleId);
		if (ytsRole == null) {
			log.warn("YTS role with ID '{}' not found in the guild. Skipping YTS role synchronization.", ytsRoleId);
			return;
		}

		Set<String> pendingDiscordIds = pendingContestants.stream()
			.map(pc -> pc.user().getDiscordId())
			.collect(Collectors.toSet());

		for (UserRound ur : allAssignments) {
			if (ur.getUserRole() != UserRoleType.CONTESTANT) {
				continue;
			}

			String discordId = ur.getUser().getDiscordId();
			UserSnowflake snowflake = UserSnowflake.fromId(discordId);

			try {
				// Add the YTS role to users who are pending submission, and remove it
				// from those who are not
				// Use complete() to ensure the role assignment is executed before sending
				// the reminder message
				if (pendingDiscordIds.contains(discordId)) {
					channel.getGuild().addRoleToMember(snowflake, ytsRole).complete();
				}
				else {
					channel.getGuild().removeRoleFromMember(snowflake, ytsRole).complete();
				}
			}
			catch (Exception e) {
				log.warn("Error while synchronizing YTS role for user with Discord ID {}: {}", discordId,
						e.getMessage());
			}
		}
	}

	private void saveState(String statePrefix, Set<Double> sentHours) {
		systemSettingService.setInternalSetting(STATE_KEY,
				statePrefix + sentHours.stream()
					.sorted(Comparator.reverseOrder())
					.map(String::valueOf)
					.collect(Collectors.joining(",")));
	}

	private List<PendingContestant> getPendingContestants(Round activeRound, List<UserRound> allAssignments) {
		Map<Integer, Long> judgeCountByGroup = allAssignments.stream()
			.filter(assignment -> assignment.getUserRole() == UserRoleType.JUDGE)
			.collect(Collectors.groupingBy(UserRound::getGroupNumber, Collectors.counting()));

		return allAssignments.stream()
			.filter(assignment -> assignment.getUserRole() == UserRoleType.CONTESTANT)
			.map(assignment -> {
				long requiredSongs = judgeCountByGroup.getOrDefault(assignment.getGroupNumber(), 0L);
				long submittedSongs = submissionService.countSubmittedSongs(activeRound.getIdRound(),
						assignment.getUser().getIdUser());
				return new PendingContestant(assignment.getUser(), Math.max(0, requiredSongs - submittedSongs));
			})
			.filter(contestant -> contestant.songCount() > 0)
			.sorted(Comparator.comparing(contestant -> contestant.user().getUsername(), String.CASE_INSENSITIVE_ORDER))
			.toList();
	}

	private String buildMessage(Round round, Instant deadline, double currentThreshold) {
		long deadlineEpoch = deadline.getEpochSecond();

		String ytsRoleId = systemSettingService.getSetting("yts_role_id").orElse("");
		String rolePing = ytsRoleId.isEmpty() ? "" : "<@&" + ytsRoleId + ">";

		String displayHour = (currentThreshold == (long) currentThreshold)
				? String.format("%d", (long) currentThreshold) : String.valueOf(currentThreshold);

		StringBuilder message = new StringBuilder();
		message.append("**Round ")
			.append(round.getRoundNumber())
			.append(" Submission Reminder**\n\n")
			.append(rolePing)
			.append(", the deadline to submit your songs is <t:")
			.append(deadlineEpoch)
			.append(":R>.\n")
			.append("Deadline: <t:")
			.append(deadlineEpoch)
			.append(":F>\n")
			.append("Automatic ")
			.append(displayHour)
			.append("-hour reminder.");

		if (message.length() > 2000) {
			throw new IllegalStateException("The submission reminder is too long to send as one Discord message.");
		}

		return message.toString();
	}

	private Set<Double> parseSentHours(String expectedPrefix) {
		String state = systemSettingService.getSetting(STATE_KEY).orElse("");
		if (!state.startsWith(expectedPrefix)) {
			return new HashSet<>();
		}

		Set<Double> hours = new HashSet<>();
		String serializedHours = state.substring(expectedPrefix.length());
		for (String value : serializedHours.split(",")) {
			try {
				hours.add(Double.parseDouble(value));
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
