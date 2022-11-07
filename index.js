const { App } = require("@slack/bolt");
const { Client, LogLevel } = require("@notionhq/client");
const { translateText } = require("./src/translator");
const { removeUnecessaryProperties } = require("./src/utils");
const notion = new Client({
    auth: process.env.NOTION_API_TOKEN,
    logLevel: LogLevel.DEBUG,
});

const debug = true;
let from = null;
let to = null;

const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN,
});

/**
 * @notice Translate the specified page and return the translated page URL
 * @return Successful: newPageUrl, Failed: Error Object
 * */
const main = async (pageId) => {
    if (!process.env.NOTION_API_TOKEN) {
        throw new Error("Invalid Notion API token");
    }
    if (!process.env.DEEPL_API_TOKEN) {
        throw new Error("Invalid DeepL API token");
    }

    let originalPage;
    try {
        originalPage = await notion.pages.retrieve({ page_id: pageId });
    } catch (e) {
        try {
            await notion.databases.retrieve({ database_id: pageId });
            throw new Error(
                "This URL is a database. This tool currently supports only pages."
            );
        } catch (_) {
            throw new Error(
                `ERROR: Failed to read the page content!\n\nError details: ${e}\n\nPlease make sure the following:\n * The page is shared with your app\n * The API token is the one for this workspace`
            );
        }
    }

    const translatedBlocks = await buildTranslatedBlocks(originalPage.id, 0);
    const newPage = await createNewPageForTranslation(originalPage);
    const blocksAppendParams = {
        block_id: newPage.id,
        children: translatedBlocks,
    };
    await notion.blocks.children.append(blocksAppendParams);
    from = to = null;
    return { newPageUrl: newPage.url };
};

async function buildTranslatedBlocks(id, nestedDepth) {
    const translatedBlocks = [];
    let cursor = undefined;
    let hasMore = true;
    while (hasMore) {
        const blocks = await notion.blocks.children.list({
            block_id: id,
            start_cursor: cursor,
            page_size: 100, // max 100
        });
        // Print dot for the user that is waiting for the completion
        process.stdout.write(".");

        for (const result of blocks.results) {
            let b = result;
            if (nestedDepth >= 2) {
                b.has_children = false;
            }
            if (nestedDepth == 1) {
                if (b.type === "column_list") {
                    // If this column_list block is already in the one-level nested children,
                    // its children (= column blocks) are unable to have children
                    b.column_list.children = [];
                    continue;
                }
            }
            if (b.type === "file") {
                if (b.file.type === "external") {
                    if (!b.file.url || b.file.url.trim().length === 0) {
                        // The API endpoint for 3rd parties rejects the empty external file URL pattern even though it can exist
                        continue;
                    }
                } else {
                    // The file blocks do not work in a copied page
                    const notice = [
                        {
                            plain_text: "(The file was removed from this page)",
                            text: { content: "" },
                        },
                    ];
                    await translateText(notice, "en", to);
                    b = {
                        type: "paragraph",
                        paragraph: {
                            color: "default",
                            rich_text: notice,
                        },
                    };
                }
            }
            if (b.type === "image") {
                if (b.image.type !== "external") {
                    // The image blocks with internal URLs may not work in a copied page
                    // See https://github.com/seratch/notion-translator/issues/1 for more details
                    const notice = [
                        {
                            plain_text: "(The image was removed from this page)",
                            text: { content: "" },
                        },
                    ];
                    await translateText(notice, "en", to);
                    b = {
                        type: "paragraph",
                        paragraph: {
                            color: "default",
                            rich_text: notice,
                        },
                    };
                }
            }
            if (b.type === "child_page") {
                // Convert a child_page in the original page to link_to_page
                try {
                    b.type = "link_to_page";
                    const page = await notion.pages.retrieve({ page_id: b.id });
                    b.link_to_page = {
                        type: "page_id",
                        page_id: page.id,
                    };
                    delete b.child_page;
                    b.has_children = false;
                } catch (e) {
                    if (debug) {
                        console.log(
                            `Failed to load a page (error: ${e}) - Skipped this block.`
                        );
                    }
                    continue;
                }
            } else if (b.type === "child_database") {
                // Convert a child_database in the original page to link_to_page
                try {
                    b.type = "link_to_page";
                    const d = await notion.databases.retrieve({ database_id: b.id });
                    b.link_to_page = {
                        type: "database_id",
                        database_id: d.id,
                    };
                    delete b.child_database;
                    b.has_children = false;
                } catch (e) {
                    if (debug) {
                        console.log(
                            `Failed to load a database (error: ${e}) - Skipped this block.`
                        );
                    }
                    continue;
                }
            } else if (b.has_children) {
                if (nestedDepth >= 3) {
                    // https://developers.notion.com/reference/patch-block-children
                    // > For blocks that allow children, we allow up to two levels of nesting in a single request.
                    continue;
                }
                // Recursively call this method for nested children blocks
                b[b.type].children = await buildTranslatedBlocks(b.id, nestedDepth + 1);
            }
            removeUnecessaryProperties(b);
            // Translate all the text parts in this nest level
            for (const [k, v] of Object.entries(b)) {
                if (v instanceof Object) {
                    for (const [_k, _v] of Object.entries(v)) {
                        if (_k === "caption" || (_k === "rich_text" && b.type !== "code")) {
                            const resultLangInfo = await translateText(_v, from, to);
                            if (!from) {
                                from = resultLangInfo.from;
                                to = resultLangInfo.to;
                            }
                        }
                    }
                }
            }
            // Add this valid block to the result
            translatedBlocks.push(b);
        }

        // For pagination
        if (blocks.has_more) {
            cursor = blocks.next_cursor;
        } else {
            hasMore = false;
        }
    }
    return translatedBlocks;
}

async function createNewPageForTranslation(originalPage) {
    const newPage = JSON.parse(JSON.stringify(originalPage)); // Create a deep copy
    // Create the translated page as a child of the original page
    newPage.parent = { page_id: originalPage.id };
    const originalTitle = originalPage.properties.title.title[0];
    const newTitle = newPage.properties.title.title[0];
    newTitle.text.content = originalTitle.text.content + ` (${to})`;
    newTitle.plain_text = originalTitle.plain_text + ` (${to})`;
    removeUnecessaryProperties(newPage);

    const newPageCreation = await notion.pages.create(newPage);
    return newPageCreation;
}

//メッセージが投稿された時に呼ばれるメソッド
app.message(async ({ message, say }) => {
    //ここにURLかの判定処理
    if(!/notion\.so\//.test(message.text)){
        await say("入力されたテキストはnotionのURLではありません");
        return;
    }
    const pageId = message.text.split('/').pop().split("-").pop().replace(/\>$/, "");

    await say(`<@${message.user}> ${pageId} の翻訳を開始しました。完了したら再度通知します`);
    await main(pageId)
        .then(async (result) => {
            await say(`<@${message.user}> 翻訳が完了しました！ 次のURLから確認できます。\n${result.newPageUrl}`);
        })
        .catch(async (error) => {
            await say(`<@${message.user}> 翻訳時にエラーが発生しました\n${JSON.stringify(error)}`);
        });
});
//アプリが起動時に呼ばれるメソッド
(async () => {
    await app.start(process.env.PORT || 3000);
    console.log("⚡️ Bolt app is running!");
})();
