package com.twokb.micdrop.service;

import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import javax.imageio.ImageIO;

import org.apache.poi.sl.usermodel.PaintStyle;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
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

@Service
@RequiredArgsConstructor
public class SlideGeneratorService {

	private final RoundDetailService roundDetailService;

	private final UserRoundService userRoundService;

	private final SubmissionService submissionService;

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

			List<DiscordUser> judges = userRoundService
				.getUsersByRoundIdAndRoleAndGroupNumber(idRound, groupNumber, UserRoleType.JUDGE.name().toLowerCase())
				.stream()
				.map(UserRound::getUser)
				.toList();

			// Order judges by ID to ensure judge X is always the same person
			List<DiscordUser> sortedJudges = new ArrayList<>(judges);
			sortedJudges.sort(Comparator.comparing(DiscordUser::getIdUser));

			// Calculate stats for each contestant
			List<ContestantStat> stats = roundDetailService.getGroupStats(idRound, contestants, sortedJudges);

			// Reverse the list to have the highest average score first
			Collections.reverse(stats);

			// Generate PPTX and PNG in memory
			ByteArrayOutputStream zipBaos = new ByteArrayOutputStream();
			try (ZipOutputStream zos = new ZipOutputStream(zipBaos)) {

				for (int i = 0; i < stats.size(); i++) {
					var stat = stats.get(i);
					int rank = i + 1;

					// Get the submissions for the contestant
					List<Submission> subs = submissionService.getByRoundIdAndContestantIdAndJudgeIds(idRound,
							stat.contestant().getIdUser(), sortedJudges.stream().map(DiscordUser::getIdUser).toList());

					// Establish the template
					String templateName = getTemplateName(rank, sortedJudges.size(),
							stat.contestant().getPreliminaryStatus());
					String safeUsername = stat.contestant().getUsername().replaceAll("[^a-zA-Z0-9.-]", "_");
					String filePrefix = String.format("Rank_%02d_%s", rank, safeUsername);

					try (InputStream is = new ClassPathResource("templates/" + templateName).getInputStream();
							XMLSlideShow templatePpt = new XMLSlideShow(is)) {

						XSLFSlide slide = templatePpt.getSlides().get(0);

						// Replace placeholders in the slide with actual data
						replacePlaceholders(slide, rank, stat, sortedJudges, subs);

						// Convert the slide to PNG
						Dimension pgSize = templatePpt.getPageSize();
						BufferedImage img = new BufferedImage(pgSize.width, pgSize.height, BufferedImage.TYPE_INT_ARGB);
						Graphics2D graphics = img.createGraphics();

						graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
						graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
						graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
								RenderingHints.VALUE_TEXT_ANTIALIAS_LCD_HRGB);
						graphics.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS,
								RenderingHints.VALUE_FRACTIONALMETRICS_ON);

						slide.draw(graphics);

						// Add the PNG to the ZIP
						zos.putNextEntry(new ZipEntry(filePrefix + ".png"));
						ImageIO.write(img, "png", zos);
						zos.closeEntry();

						// Export the PPTX directly
						zos.putNextEntry(new ZipEntry(filePrefix + ".pptx"));
						templatePpt.write(zos);
						zos.closeEntry();
					}
				}
			}

			return zipBaos.toByteArray();
		}
		catch (IllegalStateException | IllegalArgumentException e) {
			throw e; // Rethrow to be handled by the GlobalExceptionHandler
		}
		catch (Exception e) {
			throw new RuntimeException("Error generating slides ZIP for round " + idRound, e);
		}
	}

	private void replacePlaceholders(XSLFSlide slide, int rank, ContestantStat stat, List<DiscordUser> judges,
			List<Submission> subs) {
		Map<String, String> rep = new HashMap<>();
		rep.put("{p}", String.valueOf(rank));
		rep.put("{name}", stat.contestant().getUsername());
		rep.put("{avg}", String.format(Locale.US, "%.2f", stat.avgScore()));

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

		// Replace placeholders in the slide
		for (XSLFShape shape : slide.getShapes()) {
			if (shape instanceof XSLFTextShape textShape) {
				String text = textShape.getText();
				boolean changed = false;

				for (Map.Entry<String, String> entry : rep.entrySet()) {
					if (text.contains(entry.getKey())) {
						text = text.replace(entry.getKey(), entry.getValue());
						changed = true;
					}
				}

				if (changed) {
					// Recover the original text formatting before setting the new text
					Double originalFontSize = null;
					String originalFontFamily = null;
					PaintStyle originalFontColor = null;
					boolean isBold = false;
					boolean isItalic = false;

					if (!textShape.getTextParagraphs().isEmpty()
							&& !textShape.getTextParagraphs().get(0).getTextRuns().isEmpty()) {
						XSLFTextRun firstRun = textShape.getTextParagraphs().get(0).getTextRuns().get(0);
						originalFontSize = firstRun.getFontSize();
						originalFontFamily = firstRun.getFontFamily();
						originalFontColor = firstRun.getFontColor();
						isBold = firstRun.isBold();
						isItalic = firstRun.isItalic();
					}

					// Set the new text
					textShape.setText(text);

					// Restore the original text formatting
					for (XSLFTextParagraph p : textShape.getTextParagraphs()) {
						for (XSLFTextRun r : p.getTextRuns()) {
							if (originalFontSize != null)
								r.setFontSize(originalFontSize);
							if (originalFontFamily != null)
								r.setFontFamily(originalFontFamily);
							if (originalFontColor != null)
								r.setFontColor(originalFontColor);
							r.setBold(isBold);
							r.setItalic(isItalic);
						}
					}
				}
			}
		}
	}

	private String getTemplateName(int rank, int numJudges, ContestantStatus preliminaryStatus) {
		String suffix = numJudges == 4 ? "_4j.pptx" : "_3j.pptx";

		String prefix = switch (rank) {
			case 1 -> "1st_place";
			case 2 -> "2nd_place";
			case 3 -> "3rd_place";
			default -> (preliminaryStatus == ContestantStatus.DID_NOT_SUBMIT
					|| preliminaryStatus == ContestantStatus.ELIMINATED) ? "eliminated" : "other_place";
		};

		return prefix + suffix;
	}

}
