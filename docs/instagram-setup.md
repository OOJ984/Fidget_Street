# Instagram Feed - Manual Setup

Display your Instagram posts on the website by adding images and updating a JSON file.

## How It Works

1. Save your Instagram post image to `assets/instagram/`
2. Add an entry to `data/instagram.json`
3. Deploy (or it updates on next deploy)

## Adding a New Post

### Step 1: Save the Image

Save your Instagram post image to `assets/instagram/` with a simple name:
- `post1.jpg`
- `post2.jpg`
- Or descriptive: `fidget-dragon.jpg`

### Step 2: Update the JSON

Open `data/instagram.json` and add your post at the top:

```json
[
  {
    "id": "5",
    "link": "https://www.instagram.com/p/ABC123/",
    "caption": "Check out our new fidget dragon! Perfect for focus and fun.",
    "image": "/assets/instagram/fidget-dragon.jpg",
    "date": "2024-12-22"
  },
  {
    "id": "4",
    "link": "https://www.instagram.com/p/XYZ789/",
    "caption": "Previous post...",
    "image": "/assets/instagram/post4.jpg",
    "date": "2024-12-20"
  }
]
```

### Fields Explained

| Field | Description |
|-------|-------------|
| `id` | Unique number for each post |
| `link` | URL to your Instagram post (click Share > Copy Link on Instagram) |
| `caption` | Post caption (can be shortened) |
| `image` | Path to image in assets folder |
| `date` | Post date (YYYY-MM-DD format, used for sorting) |

## Tips

- **Image size**: Square images work best (1080x1080px ideal)
- **File format**: JPG or PNG
- **Newest first**: Posts are auto-sorted by date, newest shown first
- **Homepage shows 6**: The homepage displays 6 posts, Instagram page shows 12

## Quick Workflow

When you post to Instagram:
1. Screenshot or save the image
2. Drop it in `assets/instagram/`
3. Copy the post link from Instagram
4. Add entry to `data/instagram.json`
5. Commit and push (or wait for next deploy)

## File Locations

```
assets/
  instagram/
    post1.jpg
    post2.jpg
    ...

data/
  instagram.json
```
