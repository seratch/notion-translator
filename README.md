# Notion Translator

[![npm version](https://badge.fury.io/js/notion-translator.svg)](https://badge.fury.io/js/notion-translator)

Notion Translator is a CLI tool that enables [Notion](https://www.notion.so/) users to translate Notion pages into a different language by leveraging [the DeepL's text translation API](https://www.deepl.com/api).

You can install this tool just by running:

```bash
npm install -g notion-translator
```

## How It Works

Let's say you'd like to translate a Notion page template written in English into a differen language such as Japanese, Spainish, and French. All you need to do with **notion-translator** are:

* Create a Notion internal integration and save its token as `NOTION_API_TOKEN` env variable
* Create a DeepL API account and save its token as `DEEPL_API_TOKEN` env variable
* Share the target Notion page with your Notion integration
* Run the following command to generate a translated page automatically

```bash
notion-translator \
  --from en \
  --to ja \
  --url https://www.notion.so/acme/Blog-Post-ABC123
```

## Live Demo

Once you create your integration for translation and set the Notion / DeepL credentials in env variables, you can run the command to translate with the Notion page URL:

<img src="https://user-images.githubusercontent.com/19658/171323954-6d7e1475-4e1b-4b4e-a4b3-2adb1a81aea1.gif" width=500 />

When the translated page is ready, the CLI opens the page in the default web browser for you. The CLI generates the page as a child page of the original one, but you can move it anywhere else if you would like to do so!

<img src="https://user-images.githubusercontent.com/19658/171324207-d59f3192-9fe5-4979-9b6e-c91fd1d3c934.gif" width=500 />

## Prerequisites

To run this CLI tool, the following are required:

* [Node.js](https://nodejs.org/) runtime for running the CLI (the latest LTS version is recommended)
* [Notion Internal Integration](https://www.notion.so/my-integrations) for reading and creating Notion pages
* [DeepL API Free/Pro Account](https://www.deepl.com/pro-api) for translating text in your Notion page blocks

### Notion Internal Integration

You can configure your integration by the following steps:

* Head to https://www.notion.so/my-integrations
* Click "New integration" button
* Give an easy-to-understand name (e.g., Notion Translator) to the integration
* Make sure that you select **Read content** and **Insert content** in the **Content Capabilities** section
* Any option in the **User Capabilities** section works, but **No user information** is recommended
* Click the **Save** button

<img src="https://user-images.githubusercontent.com/19658/171321517-6ae262f1-7ac6-4415-b5f0-4c343ff31fb0.png" width=300>

Once the integration is created, you can find your **Internal Integration Token** under **Secrets** section. The string value should start with `secret_`. You will use this value as `NOTION_API_TOKEN` when configuring the CLI later.

### DeepL API Account

You can configure your DeepL API account by the following steps:

* Head to https://www.deepl.com/pro-api
* Create either Free or Pro API account

Once your account is activated, you can find your DeepL API token on [your account page](https://www.deepl.com/account/summary). YOu will use this value as `DEEPL_API_TOKEN` when configuring the CLI later.

## Configure the CLI

You can install the CLI via `npm` command.

```bash
npm install -g notion-translator
```

Let's hit `notion-translator  -h` to check if the command is now available for you.

```bash
$ notion-translator  -h
Usage: notion-translator [options]

CLI to translate a Notion page to a different language

Options:
  -u, --url <https://www.notion.so/...>
  -f, --from <bg,cs,da,de,el,en,es,et,fi,fr,hu,id,it,ja,lt,lv,nl,pl,pt,ro,ru,sk,sl,sv,tr,zh>
  -t, --to <bg,cs,da,de,el,en-gb,en-us,es,et,fi,fr,hu,id,it,ja,lt,lv,nl,pl,pt-pt,pt-br,ro,ru,sk,sl,sv,tr,zh>
  -d, --debug
  -h, --help                                                                                                  display help for command
```

Prior to running the command, set two env variables:

* `NOTION_API_TOKEN`: Notion's Internal Integration Token
* `DEEPL_API_TOKEN`: DeepL's API token

If you prefer using `.env` file, it also works as long as the file exists in the current directory.

## Run the CLI Command

Please don't forget to share the original Notion page with your integration. You can find **Share** link at the top of a Notion page. From there, you can invite your Notion Translator integration to the page.

<img src="https://user-images.githubusercontent.com/19658/171321884-ad911271-8569-449b-9d81-d476d7066cf6.png" width=300>

Okay, everything should be ready! Let's run the command now :)

```bash
notion-translator \
  --from en \
  --to ja \
  --url https://www.notion.so/acme/Blog-Post-ABC123
```

If your credentails are not properly set, the CLI opens Notion / DeepL configuration page in the default browser for you. Double-check the settings and token string values.

Also, if you are unsure about the language code to pass as from/to languages, please refer to [DeepL's official document](https://www.deepl.com/docs-api/translating-text/request/).

I hope that this tool will help you save time!

## Contributions

If you have any feedback or suggestions to this tool, please feel free to write in in this GitHub repository's issue tracker. Pull requests are welcome too!

## License

The MIT License