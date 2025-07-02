import os
import io
import torch
from PIL import Image
from torchvision import transforms, models

BASE = os.path.dirname(__file__)
VISION_PATH = os.path.join(BASE, 'best_multihead.pt')
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

HEAD_LABELS = ['Left', 'Down', 'Up', 'Center', 'Right']
GAZE_LABELS = ['Left', 'Up', 'Down', 'Center', 'Right', 'Closed']
LIP_LABELS  = ['No Movement', 'Talking']

# Model definition
class MultiHeadNet(torch.nn.Module):
    def __init__(self):
        super().__init__()
        base = models.resnet18(pretrained=True)
        self.backbone = torch.nn.Sequential(*list(base.children())[:-1])
        self.head = torch.nn.Linear(512, len(HEAD_LABELS))
        self.gaze = torch.nn.Linear(512, len(GAZE_LABELS))
        self.lip  = torch.nn.Linear(512, len(LIP_LABELS))

    def forward(self, x):
        x = self.backbone(x).view(x.size(0), -1)
        return self.head(x), self.gaze(x), self.lip(x)

# Load model
vision_model = MultiHeadNet().to(DEVICE)
vision_model.load_state_dict(torch.load(VISION_PATH, map_location=DEVICE, weights_only=True))
# print("[DEBUG bias] head:", vision_model.head.bias.data)
# print("[DEBUG bias] gaze:", vision_model.gaze.bias.data)
# print("[DEBUG bias] lip: ", vision_model.lip.bias.data)

vision_model.eval()

vision_transform = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor(),
])

def predict_head(frame_png: bytes):
    img = Image.open(io.BytesIO(frame_png)).convert('RGB')
    inp = vision_transform(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        ph, pg, pl = vision_model(inp)
    # print("[DEBUG logits] head:", ph.cpu().numpy(),
    #   "\ngaze:", pg.cpu().numpy(),
    #   "\nlip: ", pl.cpu().numpy())
    h_idx = int(ph.argmax(1)[0])
    g_idx = int(pg.argmax(1)[0])
    l_idx = int(pl.argmax(1)[0])
    return {
        'head_idx': h_idx, 'head': HEAD_LABELS[h_idx],
        'gaze_idx': g_idx, 'gaze': GAZE_LABELS[g_idx],
        'lip_idx':  l_idx, 'lip':  LIP_LABELS[l_idx],
    }