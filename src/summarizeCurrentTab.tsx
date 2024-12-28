import nodeFetch from "node-fetch";
(globalThis.fetch as typeof globalThis.fetch) = nodeFetch as never;

import { Action, ActionPanel, Detail, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { getVideoTranscript } from "./utils/getVideoTranscript";
import { useRaycastAISummary } from "./hooks/raycast/useRaycastAISummary";
import { BrowserExtension, environment } from "@raycast/api";
import { getVideoData, VideoDataTypes } from "./utils/getVideoData";
import { useFollowUpQuestion } from "./hooks/useFollowUpQuestion";
import ytdl from "ytdl-core";
import { useGetSummary } from "./hooks/useGetSummary";
import { ALERT } from "./const/toast_messages";

function canAccessBrowserExtension() {
    return environment.canAccess(BrowserExtension);
}

export default function Command() {
    const [summary, setSummary] = useState<string>();
    const [summaryIsLoading, setSummaryIsLoading] = useState<boolean>(true);
    const [transcript, setTranscript] = useState<string | undefined>();
    const [videoData, setVideoData] = useState<VideoDataTypes>();
    const { pop } = useNavigation();

    useEffect(() => {
        async function init() {
            if (!canAccessBrowserExtension()) {
                showToast({
                    style: Toast.Style.Failure,
                    title: "Error",
                    message: "Требуется установить расширение Raycast для браузера"
                });
                setSummaryIsLoading(false);
                return;
            }

            try {
                const tabs = await BrowserExtension.getTabs();
                const activeTab = tabs.find((tab) => tab.active);

                if (!activeTab || !activeTab.url.startsWith("https://www.youtube.com/watch?v=")) {
                    showToast({
                        style: Toast.Style.Failure,
                        title: "Error",
                        message: "Откройте YouTube видео в активной вкладке браузера"
                    });
                    setSummaryIsLoading(false);
                    return;
                }

                const video = activeTab.url;

                if (!ytdl.validateURL(video) && !ytdl.validateID(video)) {
                    showToast({
                        style: Toast.Style.Failure,
                        title: "Invalid URL/ID",
                        message: "The passed URL/ID is invalid, please check your input.",
                    });
                    setSummaryIsLoading(false);
                    return;
                }

                // Получаем информацию о видео
                try {
                    const data = await getVideoData(video);
                    setVideoData(data);
                } catch (e) {
                    console.error("Ошибка получения информации о видео:", e);
                    showToast({
                        style: Toast.Style.Failure,
                        title: ALERT.title,
                        message: "Error fetching video data: " + (e as Error).message,
                    });
                    setSummaryIsLoading(false);
                    return;
                }

                // Получаем транскрипт
                try {
                    const transcriptText = await getVideoTranscript(video);
                    if (!transcriptText) {
                        showToast({
                            style: Toast.Style.Failure,
                            title: ALERT.title,
                            message: "Не удалось получить субтитры для этого видео. Убедитесь, что:\n\n" +
                                "1. Видео имеет субтитры (автоматические или добавленные вручную)\n" +
                                "2. Субтитры доступны на английском или русском языке\n" +
                                "3. Видео не является прямой трансляцией или премьерой"
                        });
                        setSummaryIsLoading(false);
                        return;
                    }
                    setTranscript(transcriptText);
                } catch (e) {
                    showToast({
                        style: Toast.Style.Failure,
                        title: ALERT.title,
                        message: "Error fetching video transcript: " + (e as Error).message,
                    });
                    setSummaryIsLoading(false);
                }
            } catch (e) {
                showToast({
                    style: Toast.Style.Failure,
                    title: ALERT.title,
                    message: "Unexpected error: " + (e as Error).message,
                });
                setSummaryIsLoading(false);
            }
        }

        init();
    }, []);

    useEffect(() => {
        if (transcript === undefined) return;
        useGetSummary({
            transcript,
            setSummaryIsLoading,
            setSummary,
        });
    }, [transcript]);

    const askQuestion = (question: string) => {
        if (question === undefined || transcript === undefined) return;
        useFollowUpQuestion(question, transcript, setSummary, pop);
    };

    if (!videoData) return null;

    const { duration, ownerChannelName, ownerProfileUrl, publishDate, thumbnail, title, video_url, viewCount } = videoData;

    const markdown = summary
        ? `${summary}

![${title}](${thumbnail?.url})
  `
        : undefined;

    return (
        <Detail
            actions={
                <ActionPanel title="Video Actions">
                    <Action.Push
                        icon={Icon.QuestionMark}
                        title="Ask Follow-up Question"
                        target={
                            <Form
                                actions={
                                    <ActionPanel>
                                        <Action.SubmitForm title="Ask" onSubmit={({ question }) => askQuestion(question)} />
                                    </ActionPanel>
                                }
                            >
                                <Form.TextField id="question" title="Your Question" />
                            </Form>
                        }
                    />
                    <Action.CopyToClipboard title="Copy Result" content={markdown ?? ""} />
                    <Action.OpenInBrowser title="Go to Video" url={video_url} />
                    <Action.OpenInBrowser title="Go to Channel" url={ownerProfileUrl} />
                </ActionPanel>
            }
            isLoading={summaryIsLoading}
            markdown={markdown}
            metadata={
                videoData && (
                    <Detail.Metadata>
                        <Detail.Metadata.Label title="Title" text={title} />
                        <Detail.Metadata.Link title="Channel" target={ownerProfileUrl} text={ownerChannelName} />
                        <Detail.Metadata.Separator />
                        <Detail.Metadata.Label title="Published" text={publishDate} />
                        <Detail.Metadata.Label title="Duration" text={duration} />
                        <Detail.Metadata.Label title="Views" text={viewCount} />
                    </Detail.Metadata>
                )
            }
            navigationTitle={videoData && `${title} by ${ownerChannelName}`}
        />
    );
}