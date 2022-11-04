require("dotenv").config();
const express = require("express");
const {translateText} = require("./translator");
const {removeUnecessaryProperties} = require("./utils");
const { Client, LogLevel } =  require("@notionhq/client");

const debug = true;
let from = null;
let to = null;

const app = express();
const notion = new Client({
    auth: process.env.NOTION_API_TOKEN,
    logLevel: LogLevel.DEBUG,
});

const main = async (pageId) => {
    if (!process.env.NOTION_API_TOKEN) {
        console.error(
            'This tool requires a valid Notion API token. Head to https://www.notion.so/my-integrations, create a new app with "Read Content" and "Insert Content" permissions, and share your Notion page with the app. Once you get a token, set NOTION_API_TOKEN env variable to the token value.'
        );
        process.exit(1);
    }
    if (!process.env.DEEPL_API_TOKEN) {
        console.error(
            "This tool requires a DeepL API token. Head to https://www.deepl.com/pro-api, sign up, and grab your API token. Once you get a token, set DEEPL_API_TOKEN env variable to the token value."
        );
        process.exit(1);
    }

    let originalPage;
    try {
        originalPage = await notion.pages.retrieve({ page_id: pageId });
    } catch (e) {
        try {
            await notion.databases.retrieve({ database_id: pageId });
            console.error(
                "\nERROR: This URL is a database. This tool currently supports only pages.\n"
            );
        } catch (_) {
            console.error(
                `\nERROR: Failed to read the page content!\n\nError details: ${e}\n\nPlease make sure the following:\n * The page is shared with your app\n * The API token is the one for this workspace\n`
            );
        }
        process.exit(1);
    }
    if (debug) {
        console.log(`The page metadata: ${JSON.stringify(originalPage)}`);
    }

    process.stdout.write(
        `\nWait a minute! Now translating the following Notion page:\n${pageId}\n\n(this may take some time) ...`
    );
    const translatedBlocks = await buildTranslatedBlocks(originalPage.id, 0);
    const newPage = await createNewPageForTranslation(originalPage);
    const blocksAppendParams = {
        block_id: newPage.id,
        children: translatedBlocks,
    };
    const blocksAddition = await notion.blocks.children.append(
        blocksAppendParams
    );
    console.log(
        "... Done!\n\nDisclaimer:\nSome parts might not be perfect.\nIf the generated page is missing something, please adjust the details on your own.\n"
    );
    console.log(`Here is the translated Notion page:\n${newPage.url}\n`);
    from = to = null;
    return newPage.url;
};

async function buildTranslatedBlocks(id, nestedDepth) {
    const translatedBlocks = [];
    let cursor;
    let hasMore = true;
    while (hasMore) {
        const blocks = await notion.blocks.children.list({
            block_id: id,
            start_cursor: cursor,
            page_size: 100, // max 100
        });
        if (debug) {
            console.log(
                `Fetched original blocks: ${JSON.stringify(blocks.results, null, 2)}`
            );
        }
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
                            if(!from){
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

// getパラメータに対する処理を記述
app.get("/", async (req, res) => {
    const newPageUrl = await main(req.query.pageId);

    res.status(200).send(newPageUrl);
});

app.listen(Number(process.env.PORT) || 10000);
