import sys
import asyncio
import os
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
from pyppeteer import launch
from pyppeteer.errors import NetworkError, TimeoutError
from slugify import slugify


async def get_page_text(page):
    soup = BeautifulSoup(await page.content(), "html.parser")
    page_text = soup.get_text()
    return page_text


async def get_html_code(page):
    html_code = await page.content()
    return html_code


async def extract_urls(page, initial_url, same_website=True):
    soup = BeautifulSoup(await page.content(), "html.parser")
    urls = set()

    # Extract URLs from anchor tags
    for link in soup.find_all("a"):
        href = link.get("href")
        if href:
            absolute_url = urljoin(initial_url, href)
            if same_website and is_same_website(initial_url, absolute_url):
                urls.add(absolute_url)
            elif not same_website:
                urls.add(absolute_url)

    return urls


def is_same_website(url1, url2):
    domain1 = urlparse(url1).netloc
    domain2 = urlparse(url2).netloc
    return domain1 == domain2


async def scrape_webpage(url, same_website=True):
    browser = await launch()
    page = await browser.newPage()
    await page.goto(url, {"timeout": 5000})  # Increased timeout to 5 seconds
    await asyncio.sleep(3)  # wait for the page to load

    try:
        # Get the page text
        page_text = await get_page_text(page)

        # Get the HTML code
        html_code = await get_html_code(page)

        # Extract related URLs
        related_urls = await extract_urls(page, url, same_website)

        await browser.close()

        return page_text, html_code, related_urls

    except (NetworkError, TimeoutError) as e:
        print(f"Error occurred while scraping {url}: {str(e)}. Skipping...")
        await browser.close()
        return None, None, set()


async def scrape_related_webpages(initial_url, screenshot_directory, same_website=True):
    if not os.path.exists(screenshot_directory):
        os.makedirs(screenshot_directory)

    visited_urls = set()
    urls_to_scrape = [initial_url]

    while urls_to_scrape:
        current_url = urls_to_scrape.pop(0)
        if current_url in visited_urls:
            continue

        page_text, html_code, related_urls = await scrape_webpage(
            current_url, same_website
        )

        if page_text is not None and html_code is not None:
            print(f"Scraped {current_url}")
            print("Related URLs:")
            for url in related_urls:
                print(url)

            visited_urls.add(current_url)
            urls_to_scrape.extend(
                url for url in related_urls if url not in visited_urls
            )

            # Capture a screenshot of the page with the respective URL as the filename
            # screenshot_filename = urlparse(current_url).netloc + ".png"
            # screenshot_filename = current_url + ".png"
            screenshot_filename = slugify(current_url) + ".png"
            screenshot_path = os.path.join(screenshot_directory, screenshot_filename)
            await capture_screenshot(current_url, screenshot_path)

            print(f"Screenshot saved for {current_url} at {screenshot_path}\n")


async def capture_screenshot(url, save_path):
    browser = await launch()
    page = await browser.newPage()
    await page.goto(url, {"timeout": 5000})  # Increased timeout to 5 seconds
    await asyncio.sleep(3)  # wait for the page to load

    try:
        await page.screenshot({"path": save_path, "fullPage": True})
        await browser.close()
    except (NetworkError, TimeoutError) as e:
        print(
            f"Error occurred while capturing screenshot for {url}: {str(e)}. Skipping..."
        )
        await browser.close()


async def main():
    if len(sys.argv) < 2:
        print("Please provide the initial URL as an argument.")
        return

    initial_url = sys.argv[1]
    screenshot_directory = "C:/Users/alexd/Documents/genius+/waypost_bot/screenshots"
    same_website = (
        True if len(sys.argv) >= 3 and sys.argv[2] == "same_website" else False
    )

    await scrape_related_webpages(initial_url, screenshot_directory, same_website)


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(main())

# how to run it:
# python webscraper.py https://www.waypost.ai/demo/dashboard same_websites
# same_websites means it only evaluates urls from that particular website, not external links
# currently only same_websites == true is relevant
