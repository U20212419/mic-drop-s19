package com.twokb.micdrop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.twokb.micdrop.listener.DiscordEventListener;

import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.JDABuilder;
import net.dv8tion.jda.api.requests.GatewayIntent;

@Configuration
public class DiscordBotConfig {

	// Inject the Discord bot token from application properties
	@Value("${discord.bot.token}")
	private String botToken;

	@Bean
	public JDA jda(DiscordEventListener eventListener) {
		try {
			// Build the JDA instance with the provided bot token
			return JDABuilder.createDefault(botToken)
				.enableIntents(GatewayIntent.GUILD_MESSAGE_REACTIONS)
				.addEventListeners(eventListener) // Register event listeners
				.build()
				.awaitReady(); // Wait until JDA is fully loaded
		}
		catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new RuntimeException("Discord bot initialization was interrupted", e);
		}
		catch (Exception e) {
			throw new RuntimeException("Failed to initialize Discord bot", e);
		}
	}

}
