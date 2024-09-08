import discord
from discord.ext import commands, tasks
import requests
from bs4 import BeautifulSoup
import os
import random
from dotenv import load_dotenv
import asyncio

load_dotenv()

os.system("pip install -r requirements.txt")

GUILD_ID = os.getenv("GUILD_ID")
CHANNEL_ID = os.getenv("CHANNEL_ID")
base_url = "https://yande.re/post?page="

intents = discord.Intents.default()
intents.messages = True
intents.guilds = True
intents.presences = True
intents.reactions = True

bot = commands.Bot(command_prefix='!', intents=intents)

from flask import Flask, render_template
import threading
import time

app = Flask(__name__)

@app.route("/")
def home():
    return "Bot is running!"

def keep_alive():
    app.run(host="0.0.0.0", port=3000)

if __name__ == "__main__":
    keep_alive_thread = threading.Thread(target=keep_alive)
    keep_alive_thread.start()

@bot.event
async def on_ready():
    print(f'{bot.user.name} has connected!')
  
    send_images.start()

@tasks.loop(minutes=1)
async def send_images():
    guild = bot.get_guild(GUILD_ID)
    if guild:
        channel = guild.get_channel(CHANNEL_ID)
        if channel:
            for page_number in range(1, 999999999999999):
                url = f"{base_url}{page_number}"

                response = requests.get(url)
                soup = BeautifulSoup(response.content, "html.parser")

                images = soup.find_all("img")

                for image in images:
                    src = image.get("src")
                    if src and src.startswith("https://assets.yande.re/data/"):
                        time.sleep(10)
                        await channel.send(src)

@send_images.before_loop
async def before_send_images():
    await bot.wait_until_ready()

bot.run(os.getenv("TOKEN"))
