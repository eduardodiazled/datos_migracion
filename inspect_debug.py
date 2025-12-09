import pandas as pd
file = "DATOS/2024/a0c2bff7-95d3-4d30-900a-4e7f231383fa-05122501533.xlsx"
df = pd.read_excel(file, header=None)
print(df.head(20))
