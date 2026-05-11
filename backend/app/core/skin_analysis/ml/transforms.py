import torchvision.transforms as T

# FaRL specific normalization stats
_FARL_MEAN = [0.48145466, 0.4578275,  0.40821073]
_FARL_STD  = [0.26862954, 0.26130258, 0.27577711]

# The preprocessing pipeline
get_test_transform = T.Compose([
    T.Resize((256, 256)),
    T.CenterCrop(224),
    T.ToTensor(),
    T.Normalize(mean=_FARL_MEAN, std=_FARL_STD),
])