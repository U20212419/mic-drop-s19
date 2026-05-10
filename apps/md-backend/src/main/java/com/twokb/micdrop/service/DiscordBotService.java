package com.twokb.micdrop.service;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.entities.emoji.Emoji;

@Service
@RequiredArgsConstructor
public class DiscordBotService {

	private final JDA jda;

	private final SystemSettingService systemSetting;

	public void sendSingUpMessage(String channelId) {
		TextChannel channel = jda.getTextChannelById(channelId);

		if (channel != null) {
			String messageText = "**Season XIX Contestant**\n" + "React to give yourself a role.\n\n"
					+ "☠️: ``Season XIX Contestant``";

			channel.sendMessage(messageText).queue(message -> {
				// Add the specific emoji reaction to the message
				message.addReaction(Emoji.fromUnicode("☠️")).queue();

				// Store the message ID in database
				systemSetting.setSetting("signup_message_id", message.getId());
			});
		}
		else {
			throw new IllegalArgumentException("Channel with ID " + channelId + " not found.");
		}
	}

}
