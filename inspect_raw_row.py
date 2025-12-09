
import pandas as pd

FILE_PATH = r'c:/Users/Power/Desktop/datos_migracion/DATOS/2024/a0c2bff7-95d3-4d30-900a-4e7f231383fa-05122501533.xlsx'

def inspect():
    # Read Table 5 and Table 31
    print("Reading Table 5...")
    df5 = pd.read_excel(FILE_PATH, sheet_name='Table 5', header=None, nrows=10)
    print("Table 5 Head:")
    print(df5)
    print("Table 5 shape:", df5.shape)
    
    print("\nReading Table 31...")
    df31 = pd.read_excel(FILE_PATH, sheet_name='Table 31', header=None, nrows=10)
    print("Table 31 Head:")
    print(df31)
    print("Table 31 shape:", df31.shape)
    
if __name__ == '__main__':
    inspect()
