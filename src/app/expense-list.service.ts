import { Injectable } from "@angular/core";
import { Observable, of, Subject } from "rxjs";
import { ExpenseModel } from "src/models/expense.model";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

@Injectable({
  providedIn: 'root'
})
export class ExpenseListService {
  private values: number[] = [];
  private colors: string[] = [];
  private categoryNames: string[] = []; 
  private data: ExpenseModel[] = [];
  private percentages: number[] = [];
  private singleData: ExpenseModel | null = null;
  public updateList: Subject<void> = new Subject<void>();
  private sum = 0;
  DIRECTORY = Directory.Documents;
  FILE_PATH = 'expenses/expenseFile.json';

  constructor() {
    this.initializeFile();
  }
  
  async initializeFile(): Promise<void> {
    try {
      //Ensuring that the parent directory exists
      await this.ensureDirectoryExists();
  
      //Checking if the file exists
      const fileExists = await this.checkIfFileExists();
  
      if (!fileExists) {
        const initialData: ExpenseModel[] = [];
        await Filesystem.writeFile({
          path: this.FILE_PATH,
          data: JSON.stringify(initialData, null, 2),
          directory: this.DIRECTORY,
          encoding: Encoding.UTF8,
        });
  
        console.log('File created successfully with initial empty data.');
      } else {
        console.log('File already exists, skipping creation.');
      }
    } catch (error) {
      console.error('Error initializing file:', error);
    }
  }
  
  async checkIfFileExists(): Promise<boolean> {
    try {
      await Filesystem.stat({
        path: this.FILE_PATH,
        directory: this.DIRECTORY,
      });
      return true; //File exists
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        return false; //File does not exist
      } else {
        throw error; 
      }
    }
  }
  
  async ensureDirectoryExists(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: 'expenses',
        directory: this.DIRECTORY,
        recursive: true, //Create parent directories if necessary
      });
      console.log('Directory ensured.');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Directory already exists')) {
        console.log('Directory already exists.');
      } else {
        console.error('Error ensuring directory exists:', error);
      }
    }
  }  

  setExpenseDetails(val: number, col: string, category: string) {
    //setting a default colour
    if(col == ''){
      col = this.generateRandomColor();
    }

    //reading existing data from the file
    this.ReadFileData().then(() => {
      //checking if the category already exists and if so, replacing it with the new info
      const existingIndex = this.categoryNames.findIndex(existingCategory => existingCategory === category);

      if (existingIndex !== -1) {
        //updating existing category with new info
        this.values[existingIndex] = val;
        this.colors[existingIndex] = col;
      } else {
        //adding new entry if category does not exist
        this.values.push(val);
        this.colors.push(col);
        this.categoryNames.push(category);
      }
  
      console.log("Updated values:", this.values);
      console.log("Updated colors:", this.colors);
      console.log("Updated category names:", this.categoryNames);
  
      this.singleData = new ExpenseModel(col, val, category);
  
      //Update data and write to file
      this.updateData().subscribe(() => {
        this.writeDataToFile();
      });
    }).catch((error) => {
      console.error('Error reading existing data before setting new details:', error);
    });
  }  

  deleteFromFile(categoryName: string) {
    this.ReadFileData().then(() => {
      // Finding the index of the category to delete
      const existingIndex = this.categoryNames.findIndex(existingCategory => existingCategory === categoryName);
  
      // If the category exists, remove it from the arrays along with all its corresponding data
      if (existingIndex !== -1) {
        this.categoryNames.splice(existingIndex, 1); 
        this.values.splice(existingIndex, 1); 
        this.colors.splice(existingIndex, 1); 
      }
  
      // Updating the data after deletion
      this.updateData().subscribe(() => {
        this.writeDataToFile();
        this.updateList.next();//using this subject in order to alert subscribed pages that data was deleted.
      });
    }).catch((error) => {
      console.error('Error reading existing data before setting new details:', error);
    });
  }
  
  updateData(): Observable<ExpenseModel[]> {
    this.data = []; 
    this.calculateData();
  
    if (this.values.length === this.colors.length && this.values.length === this.categoryNames.length) {
      for (let i = 0; i < this.values.length; i++) {
        const expense = new ExpenseModel(this.colors[i], this.values[i], this.categoryNames[i], this.percentages[i]);
        this.data.push(expense);
      }
    } else {
      console.error("Values, colors, and category names arrays must have the same length.");
    }
  
    return of(this.data);
  }
  
  async writeDataToFile() {
    try {
      let existingData: ExpenseModel[] = [];
      try {
        await this.checkIfFileExists();
        // await this.ReadFileData();
        existingData = [...this.data]; // Store the existing data read from the file
      } catch (error) {
        console.error('Error reading existing data from file:', error);
        return;
      }
  
      //Writing the updated data back to the file
      const updatedDataString = JSON.stringify(existingData, null, 2);
      await Filesystem.writeFile({
        path: this.FILE_PATH,
        data: updatedDataString,
        directory: this.DIRECTORY,
        encoding: Encoding.UTF8,
      });
  
      console.log('Data successfully appended to file');
    } catch (error) {
      console.error('Error writing data to file:', error);
    }
  }
  
  //Reading data from the file
  async ReadFileData(): Promise<void> {
    try {
      await this.checkIfFileExists();
      
      const readFile = await Filesystem.readFile({
        path: this.FILE_PATH,
        directory: this.DIRECTORY,
        encoding: Encoding.UTF8,
      });
  
      const dataString = typeof readFile.data === 'string' ? readFile.data : await readFile.data.text();
      const parsedData = JSON.parse(dataString);
  
      this.data = parsedData.map((item: ExpenseModel) => ({
        value: item.value,
        color: item.color,
        categoryName: item.categoryName
      }));
  
      this.values = this.data.map(expense => expense.value);
      this.colors = this.data.map(expense => expense.color);
      this.categoryNames = this.data.map(expense => expense.categoryName);
  
      console.log('Data read from file:', this.data);
    } catch (error) {
      console.error('Error reading data from file:', error);
    }
  }  

  calculateData(): void {
    this.sum = this.values.reduce((acc, val) => acc + val, 0);

    for (let i = 0; i < this.values.length; i++) {
      this.percentages[i] = parseFloat(((this.values[i] / this.sum) * 100).toFixed(1));
    }    
  }

  //Function to generate a random hex color
  generateRandomColor(): string {
    const letters = '0123456789ABCDEF';  
    let color = '#';  
    for (let i = 0; i < 6; i++) {  
      color += letters[Math.floor(Math.random() * 16)]; 
    }
    return color;
  }

  getData(): ExpenseModel[] {
    return this.data;
  }

  getValues(): number[] {
    console.log("Getting values: " + this.values);
    return this.values; 
  }

  getColors(): string[] {
    console.log("Getting colors: " + this.colors);
    return this.colors; 
  }

  getCategoryNames(): string[] {
    return this.categoryNames;
  }

  getSingleData(): ExpenseModel | null {
    return this.singleData;
  }

  getPercentages(): number[] {
    return this.percentages;
  }
}
