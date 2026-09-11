package com.twokb.micdrop.service;

import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.TexturePaint;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Rectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.time.Instant;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import javax.imageio.ImageIO;

import org.apache.poi.sl.usermodel.PictureData;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFPictureData;
import org.apache.poi.xslf.usermodel.XSLFPictureShape;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTextParagraph;
import org.apache.poi.xslf.usermodel.XSLFTextRun;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Submission;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;
import com.twokb.micdrop.service.RoundDetailService.ContestantStat;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class SlideGeneratorService {

	private final RoundDetailService roundDetailService;

	private final UserRoundService userRoundService;

	private final SubmissionService submissionService;

	private static final Color COLOR_GOLD = new Color(255, 223, 102);

	private static final Color COLOR_GREEN = new Color(119, 221, 119);

	private static final Color COLOR_RED = new Color(255, 105, 97);

	private static final Color COLOR_WHITE = Color.WHITE;

	public byte[] generateRoundSlidesZip(Integer idRound, Integer groupNumber) {
		try {
			// Fetch contestants and judges for the specified round and group
			List<DiscordUser> contestants = userRoundService
				.getUsersByRoundIdAndRoleAndGroupNumber(idRound, groupNumber,
						UserRoleType.CONTESTANT.name().toLowerCase())
				.stream()
				.map(UserRound::getUser)
				.toList();

			// Ensure preliminaryStatus are set for every contestant
			if (contestants.stream().anyMatch(c -> c.getPreliminaryStatus() == null)) {
				throw new IllegalStateException("Statuses must be calculated before generating slides.");
			}

			// Order judges by field sortOrder to ensure judge X is always the same person
			// and is in a specific order
			List<DiscordUser> sortedJudges = userRoundService
				.getUsersByRoundIdAndRoleAndGroupNumber(idRound, groupNumber, UserRoleType.JUDGE.name().toLowerCase())
				.stream()
				.sorted(Comparator.comparing(ur -> ur.getSortOrder() == null ? 999 : ur.getSortOrder()))
				.map(UserRound::getUser)
				.toList();

			// Calculate stats for each contestant
			List<ContestantStat> stats = roundDetailService.getGroupStats(idRound, contestants, sortedJudges);

			// Reverse the list to have the highest average score first
			Collections.reverse(stats);

			// Append contestants with DID_NOT_SUBMIT preliminary status at the end of the
			// list since getGroupStats only returns contestants that submitted at least
			// one song
			List<ContestantStat> didNotSubmitStats = contestants.stream()
				.filter(c -> c.getPreliminaryStatus() == ContestantStatus.DID_NOT_SUBMIT)
				.map(c -> new ContestantStat(c, 0.0, 0, Instant.MAX))
				.collect(Collectors.toList());

			stats.addAll(didNotSubmitStats);

			List<Integer> contestantIds = contestants.stream().map(DiscordUser::getIdUser).toList();
			List<Submission> allGroupSubmissions = submissionService.getSubmissionsByRoundIdAndContestantIds(idRound,
					contestantIds);

			Map<Integer, List<Submission>> subsByContestant = allGroupSubmissions.stream()
				.collect(Collectors.groupingBy(s -> s.getContestant().getId().getUserId()));

			// Download and process avatars concurrently to improve performance
			Map<Integer, byte[]> avatarCache = new ConcurrentHashMap<>();
			ExecutorService avatarExecutor = Executors.newFixedThreadPool(30);
			List<java.util.concurrent.CompletableFuture<Void>> avatarTasks = stats.stream()
				.map(stat -> java.util.concurrent.CompletableFuture.runAsync(() -> {
					byte[] avatarBytes = getCircularAvatarBytes(stat.contestant());
					if (avatarBytes != null) {
						avatarCache.put(stat.contestant().getIdUser(), avatarBytes);
					}
				}, avatarExecutor))
				.toList();

			log.info("Downloading and processing avatars for {} contestants concurrently.", stats.size());
			CompletableFuture.allOf(avatarTasks.toArray(new CompletableFuture[0])).join();
			avatarExecutor.shutdown();
			log.info("Completed downloading and processing avatars for all contestants.");

			// Generate PPTX and PNG in memory
			ByteArrayOutputStream zipBaos = new ByteArrayOutputStream();
			try (ZipOutputStream zos = new ZipOutputStream(zipBaos)) {
				// Choose the master template based on the number of judges
				String suffix = sortedJudges.size() == 4 ? "_4j.pptx" : "_3j.pptx";
				String masterTemplateName = "master_templates" + suffix;

				// Force font fallback to SansSerif to avoid missing font issues in Apache
				// POI
				System.setProperty("org.apache.poi.sl.draw.font.fallback", "SansSerif");

				// Load the master template
				try (InputStream is = new ClassPathResource("templates/" + masterTemplateName).getInputStream();
						XMLSlideShow combinedPpt = new XMLSlideShow(is)) {
					int baseTemplateCount = combinedPpt.getSlides().size();

					for (int i = 0; i < stats.size(); i++) {
						var stat = stats.get(i);
						String rank = stat.contestant().getPreliminaryStatus() == ContestantStatus.DID_NOT_SUBMIT
								? "DNS" : String.valueOf(i + 1);

						// Get the submissions for the contestant
						List<Integer> judgeIds = sortedJudges.stream().map(DiscordUser::getIdUser).toList();
						List<Submission> subs = subsByContestant
							.getOrDefault(stat.contestant().getIdUser(), Collections.emptyList())
							.stream()
							.filter(s -> judgeIds.contains(s.getIdJudge()))
							.toList();

						String safeUsername = stat.contestant().getUsername().replaceAll("[^a-zA-Z0-9.-]", "_");
						String filePrefix = rank.equals("DNS") ? String.format("DNS_%s", safeUsername)
								: String.format("Rank_%02d_%s", Integer.parseInt(rank), safeUsername);

						// Choose what slide template to use based on rank and preliminary
						// status
						int templateIndex = getTemplateSlideIndex(rank, stat.contestant().getPreliminaryStatus());
						XSLFSlide templateSlide = combinedPpt.getSlides().get(templateIndex);

						// Clone the template slide to keep the layout and background
						// intact
						XSLFSlide newSlide = combinedPpt.createSlide(templateSlide.getSlideLayout());
						newSlide.importContent(templateSlide);

						// Replace placeholders in the new slide
						replacePlaceholders(combinedPpt, newSlide, rank, stat, sortedJudges, subs, avatarCache);

						// Convert the slide to PNG
						Dimension pgSize = combinedPpt.getPageSize();
						BufferedImage img = new BufferedImage(pgSize.width, pgSize.height, BufferedImage.TYPE_INT_ARGB);
						Graphics2D graphics = img.createGraphics();

						graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
						graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
						graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
								RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

						if ((i + 1) % 10 == 0 || i == 0) {
							log.info("Processing slide {} of {} ({}%)", i + 1, stats.size(),
									((i + 1) * 100) / stats.size());
						}
						newSlide.draw(graphics);

						// Add the PNG to the ZIP
						zos.putNextEntry(new ZipEntry(filePrefix + ".png"));
						ImageIO.write(img, "png", zos);
						zos.closeEntry();
					}

					log.info("Completed generating slides for all contestants. Total slides: {}", stats.size());

					// Delete the original template slides from the combined PPTX to keep
					// only the generated slides
					for (int i = baseTemplateCount - 1; i >= 0; i--) {
						combinedPpt.removeSlide(i);
					}

					String combinedFileName = String.format("Round_%d_Group_%d_Slides.pptx", idRound, groupNumber);
					zos.putNextEntry(new ZipEntry(combinedFileName));
					combinedPpt.write(zos);
					zos.closeEntry();
				}
			}

			return zipBaos.toByteArray();
		}
		catch (IllegalStateException | IllegalArgumentException e) {
			throw e; // Rethrow to be handled by the GlobalExceptionHandler
		}
		catch (Exception e) {
			throw new RuntimeException("Error generating slides ZIP for round " + idRound + ".", e);
		}
	}

	private void replacePlaceholders(XMLSlideShow ppt, XSLFSlide slide, String rank, ContestantStat stat,
			List<DiscordUser> judges, List<Submission> subs, Map<Integer, byte[]> avatarCache) {
		Map<String, String> rep = new HashMap<>();
		rep.put(rank != "DNS" ? "{p}" : "#{p}", rank);
		rep.put("{name}", stat.contestant().getUsername());
		rep.put("{avg}", rank != "DNS" ? String.format(Locale.US, "%.2f", stat.avgScore()) : "N/A");

		// Map submissions by judge ID for easy access
		Map<Integer, Submission> subMap = subs.stream()
			.collect(Collectors.toMap(Submission::getIdJudge, Function.identity()));

		for (int i = 0; i < judges.size(); i++) {
			DiscordUser judge = judges.get(i);
			int jIndex = i + 1;
			Submission sub = subMap.get(judge.getIdUser());

			rep.put("{judge" + jIndex + "}", judge.getUsername());

			if (sub != null && sub.getSubLink() != null && !sub.getSubLink().isBlank()) {
				String artist = sub.getArtist() != null ? sub.getArtist() : "Unknown";
				String title = sub.getTitle() != null ? sub.getTitle() : "Unknown";
				rep.put("{song" + jIndex + "}", artist + " - " + title);
				rep.put("{score" + jIndex + "}", sub.getScore() != null ? sub.getScore().toString() : "N/A");
				rep.put("{review" + jIndex + "}", sub.getReview() != null ? sub.getReview() : "");
			}
			else {
				rep.put("{song" + jIndex + "}", "DID NOT SUBMIT");
				rep.put("{score" + jIndex + "}", "N/A");
				rep.put("{review" + jIndex + "}", "");
			}
		}

		XSLFShape avatarPlaceholder = null;
		Rectangle2D avatarAnchor = null;

		// Replace placeholders in the slide
		for (XSLFShape shape : slide.getShapes()) {
			if (shape instanceof XSLFTextShape textShape) {
				String text = textShape.getText();
				boolean changed = false;
				boolean isScoreField = false;

				// Identify if the shape is the avatar placeholder
				if ("{avatar}".equals(text.trim())) {
					avatarPlaceholder = shape;
					avatarAnchor = shape.getAnchor();
					continue;
				}

				for (Map.Entry<String, String> entry : rep.entrySet()) {
					if (text.contains(entry.getKey())) {
						text = text.replace(entry.getKey(), entry.getValue());
						changed = true;

						if (entry.getKey().startsWith("{score") || entry.getKey().equals("{avg}")) {
							isScoreField = true;
						}
					}
				}

				if (changed) {
					Color specialColor = null;
					if (isScoreField) {
						specialColor = getScoreColor(text);
					}

					// Clear existing text runs and set the new text
					// This preserves the original formatting
					boolean isFirstRun = true;
					for (XSLFTextParagraph p : textShape.getTextParagraphs()) {
						for (XSLFTextRun r : p.getTextRuns()) {
							if (isFirstRun) {
								r.setText(text);

								// Apply color
								if (specialColor != null) {
									r.setFontColor(specialColor);
								}

								isFirstRun = false;
							}
							else {
								r.setText("");
							}
						}
					}
				}
			}
		}

		// Process the avatar replacement outside the text replacement loop to avoid
		// concurrent modification issues
		if (avatarPlaceholder != null && avatarAnchor != null) {
			byte[] circularAvatarBytes = avatarCache.get(stat.contestant().getIdUser());
			if (circularAvatarBytes != null) {
				// Add the image to the slide
				XSLFPictureData pictureData = ppt.addPicture(circularAvatarBytes, PictureData.PictureType.PNG);

				// Remove the text placeholder
				slide.removeShape(avatarPlaceholder);

				// Create a picture shape at the exact coordinates of the original
				// placeholder
				XSLFPictureShape pictureShape = slide.createPicture(pictureData);
				pictureShape.setAnchor(avatarAnchor);
			}
			else {
				// If avatar fails to load, just clear the placeholder text
				((XSLFTextShape) avatarPlaceholder).setText("");
			}
		}
	}

	private byte[] getCircularAvatarBytes(DiscordUser user) {
		String avatarHash = user.getAvatar();
		String avatarUrl;

		// Check if the user has a custom avatar hash in the database
		if (avatarHash != null && !avatarHash.isBlank()) {
			// Use the stored avatar hash to construct the URL
			avatarUrl = String.format("https://cdn.discordapp.com/avatars/%s/%s.png?size=256", user.getDiscordId(),
					avatarHash);
		}
		else {
			// Calculate the default Discord avatar if no custom avatar is set
			long id = Long.parseLong(user.getDiscordId());
			long defaultAvatarIndex = (id >> 22) % 5;
			avatarUrl = String.format("https://cdn.discordapp.com/embed/avatars/%d.png", defaultAvatarIndex);
		}

		try {
			// Load the image from the URL
			URL url = new URI(avatarUrl).toURL();
			BufferedImage originalImage = ImageIO.read(url);

			if (originalImage == null)
				return null; // Failed to load image

			int width = originalImage.getWidth();
			int height = originalImage.getHeight();
			int diameter = Math.min(width, height);

			// Create a high-quality squared sub-image to ensure the circular crop is
			// centered
			BufferedImage squareImage = new BufferedImage(diameter, diameter, BufferedImage.TYPE_INT_ARGB);
			Graphics2D g2Square = squareImage.createGraphics();

			// Turn on all the high-quality rendering hints for the squared image
			g2Square.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
			g2Square.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
			g2Square.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

			// Center the original image in the square canvas
			int xOffset = (diameter - width) / 2;
			int yOffset = (diameter - height) / 2;
			g2Square.drawImage(originalImage, xOffset, yOffset, null);
			g2Square.dispose();

			// Create the final image where the circular mask will be applied
			BufferedImage circularImage = new BufferedImage(diameter, diameter, BufferedImage.TYPE_INT_ARGB);
			Graphics2D g2Circle = circularImage.createGraphics();

			// Turn on antialiasing and high-quality rendering hints for the circular
			// image
			g2Circle.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
			g2Circle.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
			g2Circle.setRenderingHint(RenderingHints.KEY_ALPHA_INTERPOLATION,
					RenderingHints.VALUE_ALPHA_INTERPOLATION_QUALITY);

			// Turn the square image into a TexturePaint and use it to paint a
			// mathematically perfect ellipse (circle)
			// Java2D applies antialiasing perfectly to shapes filled this way, resulting
			// in a smooth circular avatar
			Ellipse2D.Float circle = new Ellipse2D.Float(0, 0, diameter, diameter);
			Rectangle2D.Float anchorRect = new Rectangle2D.Float(0, 0, diameter, diameter);
			g2Circle.setPaint(new TexturePaint(squareImage, anchorRect));
			g2Circle.fill(circle);

			g2Circle.dispose();

			// Convert back to bytes to inject into the slide
			ByteArrayOutputStream baos = new ByteArrayOutputStream();
			ImageIO.write(circularImage, "png", baos);
			return baos.toByteArray();
		}
		catch (Exception e) {
			log.warn("Could not process avatar for user {}: {}", user.getIdUser(), e.getMessage());
			return null;
		}
	}

	private int getTemplateSlideIndex(String rank, ContestantStatus preliminaryStatus) {
		// If the contestant is eliminated or did not submit, use the eliminated template
		// This ensures that eliminated contestants always use the eliminated template,
		// regardless of rank
		if (preliminaryStatus == ContestantStatus.DID_NOT_SUBMIT || preliminaryStatus == ContestantStatus.ELIMINATED) {
			return 4;
		}

		return switch (rank) {
			case "1" -> 0; // 1st place
			case "2" -> 1; // 2nd place
			case "3" -> 2; // 3rd place
			default -> 3; // Other place
		};
	}

	private Color getScoreColor(String scoreText) {
		if (scoreText == null || scoreText.trim().isEmpty()) {
			return COLOR_WHITE;
		}

		String text = scoreText.trim().toUpperCase();

		if (text.equals("N/A")) {
			return COLOR_RED;
		}

		try {
			double score = Double.parseDouble(text);

			if (score == 10.0) {
				return COLOR_GOLD;
			}
			else if (score >= 9.0) {
				return COLOR_GREEN;
			}
			else if (score > 3.0) {
				return COLOR_WHITE;
			}
			else {
				return COLOR_RED;
			}
		}
		catch (NumberFormatException e) {
			return COLOR_WHITE; // Default color for unrecognized score formats
		}
	}

}
